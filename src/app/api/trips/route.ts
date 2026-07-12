import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTripSchema } from "@/lib/validators/trip.schema";
import { requireAuthenticatedProfile, requireRole } from "@/lib/auth/access";
import { ApplicationRole, TripStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/trips — return all trips ordered newest first
// ---------------------------------------------------------------------------

export async function GET() {
  const context = await requireAuthenticatedProfile();
  if (context instanceof NextResponse) {
    return context;
  }

  try {
    const trips = await prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: {
          select: { registrationNo: true, model: true, maxLoadKg: true },
        },
        driver: {
          select: { name: true, licenseExpiry: true, status: true },
        },
      },
    });
    return Response.json(trips);
  } catch (err: unknown) {
    console.error("[GET /api/trips]", err);
    return Response.json(
      { error: "Failed to fetch trips" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/trips — create a new trip and validate business rules
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const context = await requireRole(ApplicationRole.FLEET_MANAGER, ApplicationRole.DISPATCHER);
  if (context instanceof NextResponse) {
    return context;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createTripSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { vehicleId, driverId, cargoWeightKg, status } = result.data;

  try {
    // 1. Fetch Vehicle and Driver to run business validations
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      return Response.json({ error: "Selected vehicle does not exist." }, { status: 404 });
    }

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      return Response.json({ error: "Selected driver does not exist." }, { status: 404 });
    }

    // 2. Validate Business Rules
    if (vehicle.status !== "AVAILABLE") {
      return Response.json(
        { error: `Vehicle is currently ${vehicle.status.toLowerCase().replace("_", " ")} and cannot be assigned.` },
        { status: 400 }
      );
    }

    if (driver.status === "SUSPENDED") {
      return Response.json({ error: "Driver is suspended and cannot be assigned to trips." }, { status: 400 });
    }

    if (driver.status !== "AVAILABLE") {
      return Response.json(
        { error: `Driver is currently ${driver.status.toLowerCase().replace("_", " ")} and cannot be assigned.` },
        { status: 400 }
      );
    }

    const isExpired = new Date(driver.licenseExpiry).getTime() < Date.now();
    if (isExpired) {
      return Response.json({ error: "Driver has an expired license and cannot be assigned." }, { status: 400 });
    }

    if (cargoWeightKg > vehicle.maxLoadKg) {
      return Response.json(
        { error: `Cargo weight (${cargoWeightKg} kg) exceeds vehicle's maximum load capacity (${vehicle.maxLoadKg} kg).` },
        { status: 400 }
      );
    }

    // 3. Create trip & trigger status changes in a single transaction
    const newTrip = await prisma.$transaction(async (tx) => {
      const dispatchedAt = status === TripStatus.DISPATCHED ? new Date() : null;

      const trip = await tx.trip.create({
        data: {
          ...result.data,
          dispatchedAt,
        },
        include: {
          vehicle: { select: { registrationNo: true, model: true } },
          driver: { select: { name: true } },
        },
      });

      if (status === TripStatus.DISPATCHED) {
        // Change vehicle and driver status to ON_TRIP
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: "ON_TRIP" },
        });

        await tx.driver.update({
          where: { id: driverId },
          data: { status: "ON_TRIP" },
        });
      }

      return trip;
    });

    return Response.json(newTrip, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/trips]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create trip" },
      { status: 500 }
    );
  }
}
