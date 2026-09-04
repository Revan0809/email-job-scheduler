import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";

export const esClient = new Client({ node: env.elasticsearchUrl });

const INDEX = env.elasticsearchEmailIndex;

export async function ensureEmailIndex() {
  const exists = await esClient.indices.exists({ index: INDEX });
  if (!exists) {
    await esClient.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          sender: { type: "keyword" },
          scheduledTime: { type: "date" },
          sentTime: { type: "date" },
        },
      },
    });
    console.log(`[elasticsearch] Created index "${INDEX}"`);
  }
}

export interface EmailDocument {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  sender: string;
  scheduledTime: string;
  sentTime?: string | null;
}

export async function indexEmail(doc: EmailDocument) {
  try {
    await esClient.index({
      index: INDEX,
      id: doc.emailId,
      document: doc,
    });
  } catch (err) {
    console.error("[elasticsearch] Failed to index email", doc.emailId, err);
  }
}

export async function searchEmails(query: string) {
  const result = await esClient.search({
    index: INDEX,
    query: {
      multi_match: {
        query,
        fields: ["recipient", "subject", "body", "sender"],
        fuzziness: "AUTO",
      },
    },
    size: 50,
  });
  return result.hits.hits.map((hit) => ({ id: hit._id, ...(hit._source as object) }));
}
