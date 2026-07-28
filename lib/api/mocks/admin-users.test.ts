import { describe, it, expect } from 'vitest'
import { listInternalUsersMock, updateInternalUserMock } from './admin-users'

async function anyStaffId(): Promise<string> {
  const page = await listInternalUsersMock({ limit: 50 })
  const staff = page.data.find((u) => u.role !== 'ADMIN')
  if (!staff) throw new Error('fixture: expected a non-ADMIN staff user')
  return staff.id
}

/**
 * Mocks is a supported *build* mode (demo deploys), not just a test fixture —
 * so where the real backend refuses something, the mock has to refuse it the
 * same way. Otherwise a demo advertises staff-profile editing that production
 * answers with `profile_edit_unsupported`.
 */
describe('updateInternalUserMock — parity with the real backend', () => {
  it('refuses a profile-field edit, as the backend does', async () => {
    const id = await anyStaffId()
    await expect(
      updateInternalUserMock(id, { name: 'Renamed' }),
    ).rejects.toMatchObject({ code: 'profile_edit_unsupported' })
  })

  it('refuses an email edit too', async () => {
    const id = await anyStaffId()
    await expect(
      updateInternalUserMock(id, { email: 'new@nexio.com' }),
    ).rejects.toMatchObject({ code: 'profile_edit_unsupported' })
  })

  it('refuses an empty unit set rather than unbinding the user', async () => {
    const id = await anyStaffId()
    await expect(
      updateInternalUserMock(id, { businessUnitIds: [] }),
    ).rejects.toMatchObject({ code: 'unit_required' })
  })

  // The one operation the backend does support.
  it('applies a unit reassignment', async () => {
    const id = await anyStaffId()
    const updated = await updateInternalUserMock(id, {
      businessUnitIds: ['bu-9'],
    })
    expect(updated?.businessUnitIds).toEqual(['bu-9'])
  })

  it('returns null for an unknown user', async () => {
    expect(
      await updateInternalUserMock('nope', { businessUnitIds: ['bu-1'] }),
    ).toBeNull()
  })
})
