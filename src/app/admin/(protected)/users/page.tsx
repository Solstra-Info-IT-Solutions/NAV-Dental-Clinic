import type { Metadata } from "next";

import { CreateUserForm, UserRowActions } from "@/components/admin/user-management";
import { AdminPageHeader, NoPermission, Panel, Table, td, th } from "@/components/admin/ui";
import { listAdminUsers } from "@/features/admin-users/service";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatLocalDate } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Staff accounts" };

export default async function UsersPage() {
  const { admin, allowed } = await requireAdminPage("owner");
  if (!allowed) return <NoPermission />;
  const users = await listAdminUsers();

  return (
    <>
      <AdminPageHeader title="Staff accounts" description="Each person should have their own account. Never share passwords. There must always be at least one active owner." />
      <Table caption="Staff accounts">
        <thead>
          <tr>
            <th className={th}>Name</th>
            <th className={th}>Role</th>
            <th className={th}>Status</th>
            <th className={th}>Created</th>
            <th className={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={td}>
                <span className="font-medium">{u.name}</span>
                {u.id === admin.id ? <span className="ml-2 text-xs text-graphite-600">(you)</span> : null}
                <br />
                <span className="text-graphite-600">{u.email}</span>
              </td>
              <td className={`${td} capitalize`}>{u.role}</td>
              <td className={td}>{u.disabled ? <span className="font-semibold text-danger">Disabled</span> : "Active"}</td>
              <td className={td}>{formatLocalDate(u.createdAt)}</td>
              <td className={td}>
                <UserRowActions user={u} isSelf={u.id === admin.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Panel title="Add an account" className="mt-6">
        <CreateUserForm />
      </Panel>
    </>
  );
}
