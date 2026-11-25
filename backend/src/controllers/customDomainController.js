import { HttpError } from "../utils/httpError.js";
import {
  createCustomDomain,
  deleteCustomDomain,
  listCustomDomains,
  verifyCustomDomain
} from "../services/customDomainService.js";

function serializeDomain(domain) {
  return {
    id: domain._id.toString(),
    hostname: domain.hostname,
    verifiedAt: domain.verifiedAt,
    createdAt: domain.createdAt,
    verificationRecord: domain.verifiedAt
      ? null
      : {
          type: "TXT",
          name: `_shortly-verification.${domain.hostname}`,
          value: `shortly-verification=${domain.verificationToken}`
        }
  };
}

export async function listDomains(request, response, next) {
  try {
    const domains = await listCustomDomains(request.user.id);
    response.json({ items: domains.map(serializeDomain) });
  } catch (error) {
    next(error);
  }
}

export async function addDomain(request, response, next) {
  try {
    if (
      !request.body ||
      typeof request.body !== "object" ||
      Array.isArray(request.body) ||
      Object.keys(request.body).some((field) => field !== "hostname")
    ) {
      throw new HttpError(400, "Request body must contain only hostname.");
    }
    const domain = await createCustomDomain({
      hostname: request.body.hostname,
      userId: request.user.id
    });
    response.status(201).json({ domain: serializeDomain(domain) });
  } catch (error) {
    next(error);
  }
}

export async function verifyDomain(request, response, next) {
  try {
    const domain = await verifyCustomDomain({
      id: request.params.id,
      userId: request.user.id
    });
    response.json({ domain: serializeDomain(domain) });
  } catch (error) {
    next(error);
  }
}

export async function removeDomain(request, response, next) {
  try {
    await deleteCustomDomain({
      id: request.params.id,
      userId: request.user.id
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
}
