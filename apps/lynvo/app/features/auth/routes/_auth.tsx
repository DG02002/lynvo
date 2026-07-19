import { Outlet } from "react-router"

export default function AuthLayout() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-10 md:px-8 md:pt-14">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <Outlet />
      </div>
    </main>
  )
}
