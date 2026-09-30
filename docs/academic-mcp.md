# Academic MCP

Set a long random `MCP_BEARER_TOKEN` in `.env`, run `pnpm dev:mcp`, and connect ChatGPT to `http://127.0.0.1:4200/mcp` with HTTP header `Authorization: Bearer <token>`. No OpenAI API key is required. For a remote connection, terminate TLS at a trusted reverse proxy and keep the MCP process bound to a private interface unless remote access is intentional.

Tools include applicant profile, academic search/detail, source research, university/program/professor research, professor cases, funding, eligibility, deadlines, application state, outreach drafts/approval/send/batch, replies, follow-ups, research context, and transparent scoring. `analyze_academic_opportunity_ai`, `analyze_professor_case_ai`, and `generate_academic_outreach_ai` only queue durable work; the last one creates a draft only. Descriptions distinguish read-only, write, and action tools. `send_approved_outreach` and `batch_send_approved_outreach` never approve drafts and must only be called on explicit user instruction.

Example ChatGPT instruction: “Use Northstar to retrieve my profile, research official fully funded AI/robotics PhD sources in the US and Germany, persist exact evidence, evaluate uncertainty conservatively, and create professor cases. Do not send email.”
