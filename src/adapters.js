// Platform adapters: normalize BambooHR (OAuth bearer) and Greenhouse (Basic Auth)
// behind one consistent tool vocabulary. Each adapter implements the same five
// operations: createCandidate, updateCandidate, getStatuses/getStages,
// updateStatus/moveStage, listCandidates.

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable: ${name}. See README for setup.`
    );
  }
  return v;
}

// ---------- BambooHR ----------
// Auth: OAuth 2.0 bearer token with hiring:applications.write scope.
// Docs: https://documentation.bamboohr.com/reference/create-candidate
export const bamboohr = {
  name: "bamboohr",

  baseUrl() {
    const domain = requireEnv("BAMBOOHR_COMPANY_DOMAIN");
    return `https://${domain}.bamboohr.com/api/v1/applicant_tracking`;
  },

  headers() {
    const token = requireEnv("BAMBOOHR_ACCESS_TOKEN");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  },

  async createCandidate({ firstName, lastName, email, phoneNumber, jobId, ...rest }) {
    const res = await fetch(`${this.baseUrl()}/application`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ firstName, lastName, email, phoneNumber, jobId, ...rest }),
    });
    return handleResponse(res, "BambooHR createCandidate");
  },

  async updateApplicationStatus({ applicationId, statusId }) {
    const res = await fetch(`${this.baseUrl()}/applications/${applicationId}/status`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ status: statusId }),
    });
    return handleResponse(res, "BambooHR updateApplicationStatus");
  },

  async getApplicantStatuses() {
    const res = await fetch(`${this.baseUrl()}/applicant_statuses`, {
      method: "GET",
      headers: this.headers(),
    });
    return handleResponse(res, "BambooHR getApplicantStatuses");
  },

  async listApplications({ jobId } = {}) {
    const url = jobId
      ? `${this.baseUrl()}/jobs/${jobId}/applications`
      : `${this.baseUrl()}/applications`;
    const res = await fetch(url, { method: "GET", headers: this.headers() });
    return handleResponse(res, "BambooHR listApplications");
  },
};

// ---------- Greenhouse ----------
// Auth: HTTP Basic Auth, Harvest API token as username, blank password.
// Docs: https://developers.greenhouse.io/harvest.html
export const greenhouse = {
  name: "greenhouse",
  baseUrl: "https://harvest.greenhouse.io/v1",

  headers() {
    const token = requireEnv("GREENHOUSE_HARVEST_API_TOKEN");
    const credential = Buffer.from(`${token}:`).toString("base64");
    return {
      Authorization: `Basic ${credential}`,
      "Content-Type": "application/json",
      "On-Behalf-Of": process.env.GREENHOUSE_ON_BEHALF_OF_USER_ID || undefined,
    };
  },

  async createCandidate({ first_name, last_name, email, job_id, ...rest }) {
    const body = {
      first_name,
      last_name,
      applications: job_id ? [{ job_id }] : undefined,
      email_addresses: email ? [{ value: email, type: "personal" }] : undefined,
      ...rest,
    };
    const res = await fetch(`${this.baseUrl}/candidates`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return handleResponse(res, "Greenhouse createCandidate");
  },

  async moveApplicationStage({ applicationId, fromStageId, toStageId, toJobId }) {
    const body = { from_stage_id: fromStageId };
    if (toStageId) body.to_stage_id = toStageId;
    if (toJobId) body.to_job_id = toJobId;
    const res = await fetch(`${this.baseUrl}/applications/${applicationId}/move`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return handleResponse(res, "Greenhouse moveApplicationStage");
  },

  async rejectApplication({ applicationId, rejectionReasonId, rejectionNotes }) {
    const body = {};
    if (rejectionReasonId) body.rejection_reason_id = rejectionReasonId;
    if (rejectionNotes) body.rejection_notes = rejectionNotes;
    const res = await fetch(`${this.baseUrl}/applications/${applicationId}/reject`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return handleResponse(res, "Greenhouse rejectApplication");
  },

  async listCandidates({ job_id } = {}) {
    const qs = job_id ? `?job_id=${job_id}` : "";
    const res = await fetch(`${this.baseUrl}/candidates${qs}`, {
      method: "GET",
      headers: this.headers(),
    });
    return handleResponse(res, "Greenhouse listCandidates");
  },
};

async function handleResponse(res, label) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const errMsg =
      res.headers.get("x-bamboohr-error-message") ||
      (data && data.message) ||
      (Array.isArray(data) && data.join("; ")) ||
      text ||
      res.statusText;
    throw new Error(`${label} failed (HTTP ${res.status}): ${errMsg}`);
  }
  return data;
}
