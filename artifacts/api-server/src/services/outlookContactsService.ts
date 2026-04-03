import axios from "axios";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

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

function mapContact(c: any): OutlookContact {
  const emails = c.emailAddresses || [];
  const phones = c.phones || [];
  return {
    displayName: c.displayName || `${c.givenName || ""} ${c.surname || ""}`.trim() || "Unknown",
    email: emails.length > 0 ? emails[0].address : "",
    phone: phones.length > 0 ? phones[0].number : "",
    company: c.companyName || "",
    jobTitle: c.jobTitle || "",
    department: c.department || "",
  };
}

export async function queryOutlookContacts(
  accessToken: string,
  query: string,
): Promise<OutlookContactsResult> {
  const lower = query.toLowerCase();
  const cleanQuery = query
    .replace(/^(search|find|show|get|list|my|all|look\s*up)\s*/i, "")
    .replace(/\s*(contacts?|people|persons?)\s*/gi, "")
    .trim();

  const params: Record<string, string> = {
    $top: "50",
    $select: "displayName,givenName,surname,emailAddresses,phones,companyName,jobTitle,department",
    $orderby: "displayName",
  };

  if (cleanQuery.length > 2 && !lower.match(/^(all|list|show|my)\s*(contacts?)?$/)) {
    params.$filter = `startsWith(displayName,'${cleanQuery}') or startsWith(givenName,'${cleanQuery}') or startsWith(surname,'${cleanQuery}')`;
  }

  const url = `${GRAPH_BASE}/me/contacts`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    });

    let contacts = (response.data.value || []).map(mapContact);

    if (cleanQuery.length > 2 && contacts.length === 0) {
      delete params.$filter;
      const fallbackResponse = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      });
      contacts = (fallbackResponse.data.value || []).map(mapContact);
      contacts = contacts.filter((c) => {
        const searchable = `${c.displayName} ${c.email} ${c.company} ${c.jobTitle}`.toLowerCase();
        return searchable.includes(cleanQuery.toLowerCase());
      });
    }

    return { type: "contacts", contacts, total: contacts.length, source: "live" };
  } catch (err: any) {
    if (err?.response?.status === 400 && params.$filter) {
      delete params.$filter;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      });
      let contacts = (response.data.value || []).map(mapContact);
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
    const parts = [`• ${c.displayName}`];
    if (c.email) parts.push(`Email: ${c.email}`);
    if (c.phone) parts.push(`Phone: ${c.phone}`);
    if (c.jobTitle) parts.push(`Title: ${c.jobTitle}`);
    if (c.company) parts.push(`Company: ${c.company}`);
    if (c.department) parts.push(`Dept: ${c.department}`);
    return parts.join(" | ");
  });

  return `Outlook Contacts (${result.total} results):\n\n${lines.join("\n")}${q}`;
}
