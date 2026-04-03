import type { Client } from "@microsoft/microsoft-graph-client";

interface OutlookContact {
  displayName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  department: string;
}

interface OutlookContactsResult {
  type: "contacts";
  contacts: OutlookContact[];
  total: number;
  source: "live";
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function mapContact(c: any): OutlookContact {
  const emails = c.emailAddresses || [];
  const businessPhones: string[] = c.businessPhones || [];
  const homePhones: string[] = c.homePhones || [];
  const mobilePhone: string = c.mobilePhone || "";

  const phone = mobilePhone || (businessPhones.length > 0 ? businessPhones[0] : "") || (homePhones.length > 0 ? homePhones[0] : "");

  return {
    displayName: c.displayName || `${c.givenName || ""} ${c.surname || ""}`.trim() || "Unknown",
    email: emails.length > 0 ? emails[0].address : "",
    phone,
    company: c.companyName || "",
    jobTitle: c.jobTitle || "",
    department: c.department || "",
  };
}

export async function queryOutlookContacts(
  client: Client,
  userEmail: string,
  query: string,
): Promise<OutlookContactsResult> {
  const lower = query.toLowerCase();
  const cleanQuery = query
    .replace(/^(search|find|show|get|list|my|all|look\s*up)\s*/i, "")
    .replace(/\s*(contacts?|people|persons?)\s*/gi, "")
    .trim();

  const selectFields = "displayName,givenName,surname,emailAddresses,businessPhones,homePhones,mobilePhone,companyName,jobTitle,department";
  const escaped = escapeOData(cleanQuery);
  const needsFilter = cleanQuery.length > 2 && !lower.match(/^(all|list|show|my)\s*(contacts?)?$/);

  try {
    let request = client
      .api(`/users/${userEmail}/contacts`)
      .top(50)
      .select(selectFields)
      .orderby("displayName");

    if (needsFilter) {
      request = request.filter(`startsWith(displayName,'${escaped}') or startsWith(givenName,'${escaped}') or startsWith(surname,'${escaped}')`);
    }

    const response = await request.get();
    let contacts = (response.value || []).map(mapContact);

    if (needsFilter && contacts.length === 0) {
      const fallbackRequest = client
        .api(`/users/${userEmail}/contacts`)
        .top(50)
        .select(selectFields)
        .orderby("displayName");

      const fallbackResponse = await fallbackRequest.get();
      contacts = (fallbackResponse.value || []).map(mapContact);
      contacts = contacts.filter((c) => {
        const searchable = `${c.displayName} ${c.email} ${c.company} ${c.jobTitle}`.toLowerCase();
        return searchable.includes(cleanQuery.toLowerCase());
      });
    }

    return { type: "contacts", contacts, total: contacts.length, source: "live" };
  } catch (err: any) {
    if (err?.statusCode === 400 && needsFilter) {
      const request = client
        .api(`/users/${userEmail}/contacts`)
        .top(50)
        .select(selectFields)
        .orderby("displayName");

      const response = await request.get();
      let contacts = (response.value || []).map(mapContact);
      if (cleanQuery.length > 2) {
        contacts = contacts.filter((c) => {
          const searchable = `${c.displayName} ${c.email} ${c.company} ${c.jobTitle}`.toLowerCase();
          return searchable.includes(cleanQuery.toLowerCase());
        });
      }
      return { type: "contacts", contacts, total: contacts.length, source: "live" };
    }
    throw err;
  }
}

export function formatContactsResult(result: OutlookContactsResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.contacts.length === 0) return `No contacts found.${q}`;

  const lines = result.contacts.map((c) => {
    const parts = [`\u2022 ${c.displayName}`];
    if (c.email) parts.push(`Email: ${c.email}`);
    if (c.phone) parts.push(`Phone: ${c.phone}`);
    if (c.jobTitle) parts.push(`Title: ${c.jobTitle}`);
    if (c.company) parts.push(`Company: ${c.company}`);
    if (c.department) parts.push(`Dept: ${c.department}`);
    return parts.join(" | ");
  });

  return `Outlook Contacts (${result.total} results):\n\n${lines.join("\n")}${q}`;
}
