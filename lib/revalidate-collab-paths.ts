import { revalidatePath } from "next/cache";

export function revalidateCollaborationPaths(id: string) {
  revalidatePath("/collaborazioni");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath(`/collaborations/${id}`);
}
