import { createDocsSectionRoute } from "~/features/site/docs/docs-section-routes"

const {
  loader: docsSectionLoader,
  meta: docsSectionMeta,
  Component: DocsSectionComponent,
  ErrorBoundary: DocsSectionErrorBoundary,
} = createDocsSectionRoute("user")

export function loader(parameters: Parameters<typeof docsSectionLoader>[0]) {
  return docsSectionLoader(parameters)
}

export function meta(parameters: Parameters<typeof docsSectionMeta>[0]) {
  return docsSectionMeta(parameters)
}

export default function DocsRoute() {
  return <DocsSectionComponent />
}

export function ErrorBoundary(properties: { error: unknown }) {
  return <DocsSectionErrorBoundary error={properties.error} />
}
