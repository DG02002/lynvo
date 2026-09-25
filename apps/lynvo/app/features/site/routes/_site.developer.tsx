import { createDocsSectionRoute } from "~/features/site/docs/docs-section-routes"

const {
  loader: developerSectionLoader,
  meta: developerSectionMeta,
  Component: DeveloperSectionComponent,
  ErrorBoundary: DeveloperSectionErrorBoundary,
} = createDocsSectionRoute("developer")

export function loader(
  parameters: Parameters<typeof developerSectionLoader>[0]
) {
  return developerSectionLoader(parameters)
}

export function meta(parameters: Parameters<typeof developerSectionMeta>[0]) {
  return developerSectionMeta(parameters)
}

export default function DeveloperRoute() {
  return <DeveloperSectionComponent />
}

export function ErrorBoundary(properties: { error: unknown }) {
  return <DeveloperSectionErrorBoundary error={properties.error} />
}
