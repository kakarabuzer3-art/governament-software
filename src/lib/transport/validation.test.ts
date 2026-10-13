import { describe, expect, it } from "vitest";
import {
  incidentCreateSchema,
  inspectionCreateSchema,
  operatorCreateSchema,
  passengerSchema,
  parseListQuery,
  permitCreateSchema,
  routeCreateSchema,
  vehicleCreateSchema,
} from "./validation";

/**
 * Server-side validation rules (Phase 3–5). These run on the server for every
 * write, whatever the browser sent.
 */

describe("operatorCreateSchema", () => {
  it("accepts a valid operator and uppercases the code", () => {
    const parsed = operatorCreateSchema.parse({
      code: "opr-0001",
      name: "Sample Transport Co",
      status: "ACTIVE",
    });
    expect(parsed.code).toBe("OPR-0001");
    expect(parsed.status).toBe("ACTIVE");
  });

  it("rejects a malformed code", () => {
    expect(() =>
      operatorCreateSchema.parse({ code: "a", name: "X Ltd" }),
    ).toThrow();
    expect(() =>
      operatorCreateSchema.parse({ code: "bad code!", name: "X Ltd" }),
    ).toThrow();
  });

  it("rejects an invalid email and an unknown status", () => {
    expect(() =>
      operatorCreateSchema.parse({
        code: "OPR-1",
        name: "X Ltd",
        contactEmail: "not-an-email",
      }),
    ).toThrow();
    expect(() =>
      operatorCreateSchema.parse({
        code: "OPR-1",
        name: "X Ltd",
        status: "DELETED",
      }),
    ).toThrow();
  });

  it("requires a name", () => {
    expect(() => operatorCreateSchema.parse({ code: "OPR-1" })).toThrow();
  });
});

describe("vehicleCreateSchema", () => {
  it("uppercases the registration and accepts sane ranges", () => {
    const parsed = vehicleCreateSchema.parse({
      registrationNumber: "bla-1234",
      operatorId: "op-1",
      vehicleType: "COASTER",
      modelYear: "2019",
      seatingCapacity: "26",
    });
    expect(parsed.registrationNumber).toBe("BLA-1234");
    expect(parsed.modelYear).toBe(2019);
    expect(parsed.seatingCapacity).toBe(26);
  });

  it("rejects an unrealistic model year and seating capacity", () => {
    expect(() =>
      vehicleCreateSchema.parse({
        registrationNumber: "BLA-1",
        operatorId: "op-1",
        modelYear: "1800",
      }),
    ).toThrow();
    expect(() =>
      vehicleCreateSchema.parse({
        registrationNumber: "BLA-1",
        operatorId: "op-1",
        seatingCapacity: "9999",
      }),
    ).toThrow();
  });
});

describe("routeCreateSchema", () => {
  it("accepts a valid route", () => {
    const parsed = routeCreateSchema.parse({
      code: "rte-1",
      name: "Quetta to Karachi",
      originCity: "Quetta",
      destinationCity: "Karachi",
      distanceKm: "712.5",
    });
    expect(parsed.code).toBe("RTE-1");
    expect(parsed.distanceKm).toBe(712.5);
  });

  it("rejects a negative distance", () => {
    expect(() =>
      routeCreateSchema.parse({
        code: "RTE-2",
        name: "Bad",
        originCity: "A",
        destinationCity: "B",
        distanceKm: "-5",
      }),
    ).toThrow();
  });
});

describe("permitCreateSchema", () => {
  const base = {
    permitNumber: "pmt-1",
    operatorId: "op-1",
    permitType: "ROUTE",
    status: "PENDING",
    recordedSource: "MANUAL_ENTRY",
  };

  it("uppercases the permit number", () => {
    expect(permitCreateSchema.parse(base).permitNumber).toBe("PMT-1");
  });

  it("rejects an expiry date before the issue date", () => {
    expect(() =>
      permitCreateSchema.parse({
        ...base,
        issuedOn: "2026-05-10",
        expiresOn: "2026-05-01",
      }),
    ).toThrow();
  });

  it("accepts an expiry on or after the issue date", () => {
    const parsed = permitCreateSchema.parse({
      ...base,
      issuedOn: "2026-05-10",
      expiresOn: "2027-05-10",
    });
    expect(parsed.expiresOn?.getUTCFullYear()).toBe(2027);
  });
});

describe("passengerSchema (sensitive personal data)", () => {
  const base = {
    passengerName: "Synthetic Passenger",
    fatherName: "Synthetic Father",
    identityType: "CNIC",
    permanentAddress: "House 1, Sample Street",
  };

  it("accepts a 13-digit CNIC and a valid mobile", () => {
    const parsed = passengerSchema.parse({
      ...base,
      identityNumber: "17301-1234567-1",
      mobileNumber: "03001234567",
    });
    expect(parsed.passengerName).toBe("Synthetic Passenger");
  });

  it("rejects a CNIC with the wrong digit count", () => {
    expect(() =>
      passengerSchema.parse({
        ...base,
        identityNumber: "12345",
        mobileNumber: "03001234567",
      }),
    ).toThrow();
  });

  it("rejects an invalid mobile number", () => {
    expect(() =>
      passengerSchema.parse({
        ...base,
        identityNumber: "17301-1234567-1",
        mobileNumber: "12345",
      }),
    ).toThrow();
  });

  it("requires a passport-like value for the PASSPORT type", () => {
    expect(() =>
      passengerSchema.parse({
        ...base,
        identityType: "PASSPORT",
        identityNumber: "AB1",
        mobileNumber: "03001234567",
      }),
    ).toThrow();
  });
});

describe("inspectionCreateSchema (CCTV)", () => {
  it("rejects more operational cameras than recorded cameras", () => {
    expect(() =>
      inspectionCreateSchema.parse({
        siteName: "Sample Depot",
        cameraCount: "4",
        camerasOperational: "6",
      }),
    ).toThrow();
  });

  it("accepts a consistent record", () => {
    const parsed = inspectionCreateSchema.parse({
      siteName: "Sample Depot",
      cameraCount: "4",
      camerasOperational: "0",
      result: "FAIL",
    });
    expect(parsed.cameraCount).toBe(4);
    expect(parsed.camerasOperational).toBe(0);
  });
});

describe("incidentCreateSchema", () => {
  it("requires a factual description of reasonable length", () => {
    expect(() =>
      incidentCreateSchema.parse({
        reference: "INC-1",
        occurredOn: "2026-05-01T10:00",
        location: "Quetta",
        category: "Delay",
        description: "short",
      }),
    ).toThrow();
  });
});

describe("parseListQuery", () => {
  it("applies safe defaults", () => {
    expect(parseListQuery({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("clamps a hostile page size", () => {
    expect(parseListQuery({ pageSize: "99999" }).pageSize).toBe(20);
    expect(parseListQuery({ page: "-4" }).page).toBe(1);
  });

  it("keeps search and status filters", () => {
    expect(
      parseListQuery({ q: "  quetta ", status: "ACTIVE", page: "3" }),
    ).toEqual({ page: 3, pageSize: 20, q: "quetta", status: "ACTIVE" });
  });
});
