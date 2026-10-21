import type {
  AgentRun,
  Company,
  Exposure,
  Holding,
  Meta,
  PathsResponse,
  Proposals,
  ShockResponse,
  ThemesResponse,
} from "./types";
import type { Portfolio, PortfolioGraph } from "../hooks/usePortfolioData";

export const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "The backend is not reachable. Start it with uvicorn app.main:app.");
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | { detail?: unknown }
    | null;
  if (!response.ok) {
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, detail);
  }
  return body as T;
}

const json = (method: string, payload?: unknown): RequestInit => ({
  method,
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

function query(params: Record<string, string | number | boolean>): string {
  return new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  ).toString();
}

export const api = {
  graph: (id: number, depth: number, includeProposed: boolean) =>
    request<PortfolioGraph>(
      `/portfolio/${id}/graph?${query({ depth, include_proposed: includeProposed })}`
    ),
  paths: (
    id: number,
    source: string,
    target: string,
    maxHops: number,
    includeProposed: boolean
  ) =>
    request<PathsResponse>(
      `/portfolio/${id}/paths?${query({
        source,
        target,
        max_hops: maxHops,
        include_proposed: includeProposed,
      })}`
    ),
  themes: (id: number, maxHops: number, decay: number) =>
    request<ThemesResponse>(
      `/portfolio/${id}/themes?${query({ max_hops: maxHops, decay })}`
    ),
  shock: (id: number, ticker: string, maxHops: number, decay: number) =>
    request<ShockResponse>(
      `/portfolio/${id}/shock`,
      json("POST", { ticker, max_hops: maxHops, decay })
    ),
  meta: () => request<Meta>("/meta"),
  companies: (q = "", includeProposed = false) =>
    request<Company[]>(
      `/companies?${query({ q, include_proposed: includeProposed })}`
    ),
  createCompany: (payload: {
    ticker: string;
    company_name: string;
    sector: string;
    asset_class: string;
    description: string | null;
  }) => request<Company>("/companies", json("POST", payload)),
  createExposure: (payload: {
    ticker: string;
    exposed_to_ticker: string;
    via: string;
    exposure_sector: string;
    note: string;
  }) => request<Exposure>("/exposures", json("POST", payload)),
  deleteExposure: (id: number) =>
    request<void>(`/exposures/${id}`, json("DELETE")),
  createPortfolio: (name: string) =>
    request<Portfolio>("/portfolios", json("POST", { name })),
  addHolding: (id: number, ticker: string, weight: number) =>
    request<Holding[]>(
      `/portfolio/${id}/holdings`,
      json("POST", { ticker, weight })
    ),
  removeHolding: (id: number, ticker: string) =>
    request<Holding[]>(
      `/portfolio/${id}/holdings/${encodeURIComponent(ticker)}`,
      json("DELETE")
    ),
  proposals: () => request<Proposals>("/proposals"),
  reviewExposure: (id: number, approve: boolean) =>
    request<Exposure>(
      `/proposals/exposures/${id}/${approve ? "approve" : "reject"}`,
      json("POST")
    ),
  reviewCompany: (ticker: string, approve: boolean) =>
    request<Company>(
      `/proposals/companies/${encodeURIComponent(ticker)}/${
        approve ? "approve" : "reject"
      }`,
      json("POST")
    ),
  runAgent: (instruction: string, portfolioId: number | null) =>
    request<AgentRun>(
      "/agent/run",
      json("POST", { instruction, portfolio_id: portfolioId })
    ),
};
