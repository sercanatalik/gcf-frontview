import type { HTMLPerspectiveWorkspaceElement } from "@perspective-dev/workspace";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "perspective-workspace": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLPerspectiveWorkspaceElement>,
        HTMLPerspectiveWorkspaceElement
      >;
    }
  }
}
