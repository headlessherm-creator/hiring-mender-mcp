#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { bamboohr, greenhouse } from "./adapters.js";

const PLATFORMS = { bamboohr, greenhouse };

function platformOf(args) {
  const p = args.platform;
  if (!p || !PLATFORMS[p]) {
    throw new Error(
      `"platform" must be one of: ${Object.keys(PLATFORMS).join(", ")}`
    );
  }
  return PLATFORMS[p];
}

const TOOLS = [
  {
    name: "create_candidate",
    description:
      "Create a new candidate/application in BambooHR or Greenhouse. For BambooHR, provide jobId and firstName/lastName/email/phoneNumber. For Greenhouse, provide job_id and first_name/last_name/email.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["bamboohr", "greenhouse"] },
        candidate: {
          type: "object",
          description:
            "Candidate fields. Field names differ by platform — see tool description.",
        },
      },
      required: ["platform", "candidate"],
    },
  },
  {
    name: "advance_application",
    description:
      "Advance/move a candidate's application to a new stage/status. BambooHR: pass applicationId and statusId (use list_statuses first). Greenhouse: pass applicationId, fromStageId (required — guards against stale moves), and toStageId or toJobId.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["bamboohr", "greenhouse"] },
        applicationId: { type: ["string", "number"] },
        statusId: { type: ["string", "number"], description: "BambooHR only" },
        fromStageId: { type: ["string", "number"], description: "Greenhouse only, required" },
        toStageId: { type: ["string", "number"], description: "Greenhouse only" },
        toJobId: { type: ["string", "number"], description: "Greenhouse only" },
      },
      required: ["platform", "applicationId"],
    },
  },
  {
    name: "reject_application",
    description: "Reject a candidate's application. Greenhouse only (BambooHR uses advance_application with a rejection status ID instead).",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["greenhouse"] },
        applicationId: { type: ["string", "number"] },
        rejectionReasonId: { type: ["string", "number"] },
        rejectionNotes: { type: "string" },
      },
      required: ["platform", "applicationId"],
    },
  },
  {
    name: "list_statuses",
    description:
      "List valid status/stage IDs for a platform. BambooHR: returns applicant statuses (needed before advance_application). Greenhouse: use the Greenhouse UI/Job API for stage IDs; this returns candidates instead as a practical substitute.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["bamboohr", "greenhouse"] },
        jobId: { type: ["string", "number"] },
      },
      required: ["platform"],
    },
  },
  {
    name: "list_candidates",
    description: "List candidates/applications, optionally filtered by job ID.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["bamboohr", "greenhouse"] },
        jobId: { type: ["string", "number"] },
      },
      required: ["platform"],
    },
  },
];

const server = new Server(
  { name: "hiring-mender-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case "create_candidate": {
        const platform = platformOf(args);
        result = await platform.createCandidate(args.candidate);
        break;
      }
      case "advance_application": {
        const platform = platformOf(args);
        if (args.platform === "bamboohr") {
          result = await platform.updateApplicationStatus({
            applicationId: args.applicationId,
            statusId: args.statusId,
          });
        } else {
          result = await platform.moveApplicationStage({
            applicationId: args.applicationId,
            fromStageId: args.fromStageId,
            toStageId: args.toStageId,
            toJobId: args.toJobId,
          });
        }
        break;
      }
      case "reject_application": {
        if (args.platform !== "greenhouse") {
          throw new Error("reject_application is Greenhouse-only.");
        }
        result = await greenhouse.rejectApplication({
          applicationId: args.applicationId,
          rejectionReasonId: args.rejectionReasonId,
          rejectionNotes: args.rejectionNotes,
        });
        break;
      }
      case "list_statuses": {
        if (args.platform === "bamboohr") {
          result = await bamboohr.getApplicantStatuses();
        } else {
          result = await greenhouse.listCandidates({ job_id: args.jobId });
        }
        break;
      }
      case "list_candidates": {
        if (args.platform === "bamboohr") {
          result = await bamboohr.listApplications({ jobId: args.jobId });
        } else {
          result = await greenhouse.listCandidates({ job_id: args.jobId });
        }
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting hiring-mender-mcp:", err);
  process.exit(1);
});
