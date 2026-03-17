import { NextResponse } from 'next/server';

// POST - parse pasted text to extract emails
export async function POST(req: Request) {
  const { text } = await req.json();
  
  if (!text) {
    return NextResponse.json({ contacts: [] });
  }

  // Split by newlines, commas, semicolons, tabs, or spaces
  const lines = text.split(/[\n,;\t]+/).map((l: string) => l.trim()).filter(Boolean);
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const contacts: { email: string; name: string }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Try to extract email from line
    const emailMatch = line.match(emailRegex);
    if (!emailMatch) continue;
    
    const email = emailMatch[0].toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    
    // Try to extract name (text before email, or from "Name <email>" pattern)
    let name = '';
    const nameEmailPattern = /^(.+?)\s*<[^>]+>$/;
    const nameMatch = line.match(nameEmailPattern);
    if (nameMatch) {
      name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    } else {
      // Check if there's text before the email
      const beforeEmail = line.substring(0, line.indexOf(emailMatch[0])).trim();
      if (beforeEmail && !beforeEmail.match(emailRegex)) {
        name = beforeEmail.replace(/[,;\t]+$/, '').trim();
      }
    }
    
    contacts.push({ email, name });
  }

  return NextResponse.json({ contacts });
}
