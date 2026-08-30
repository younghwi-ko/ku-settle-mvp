import { POST as cancelServiceRequest } from "../route";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return cancelServiceRequest(request, context);
}
