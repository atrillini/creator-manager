import { revalidatePath } from "next/cache";

const CAL_ROUTES = ["/calendario", "/calendar"] as const;

export function revalidateCollaborationPaths(id: string) {
  revalidatePath("/collaborazioni");
  revalidatePath("/dashboard");
  for (const r of CAL_ROUTES) {
    revalidatePath(r);
  }
  revalidatePath(`/collaborations/${id}`);
}
