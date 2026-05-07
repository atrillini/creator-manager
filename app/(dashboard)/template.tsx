import type { ReactNode } from "react";

export default function DashboardTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="ui-route-enter">{children}</div>;
}
