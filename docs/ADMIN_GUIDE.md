# Admin Guide — NAV Dental Clinic

A plain-language guide for clinic staff. The admin area is at **`/admin`** on the clinic website (for example `https://<your-domain>/admin`).

## Signing in

1. Open `/admin` and sign in with your email and password.
2. Sessions end after **8 hours**. Always use **Sign out** on shared computers.
3. After 5 wrong attempts, sign-in is paused for 15 minutes.
4. Forgotten password? Ask the clinic owner to **reset** it in *Staff accounts*. You'll receive a new temporary password.

Never share your account. Each person gets their own, so the audit log shows who did what.

## Roles

| Role | Can do |
|---|---|
| **Staff** | Dashboard, appointments (confirm, reject, cancel, reschedule, complete, no-show, notes, phone bookings), schedule (block time), enquiries, notifications |
| **Owner** | Everything staff can do, plus clinic settings and opening hours, services, holidays/closures, exports, staff accounts and the audit log |

## Daily routine

1. **Dashboard:** check *Pending requests* and *New enquiries*.
2. **Pending requests:** open each one, **call the patient** on the number shown, agree the time, then press **Confirm** (add a note such as "Called 10:15, agreed"). If the time doesn't work, use **Reschedule**, or **Reject request** if the patient doesn't want another time.
3. **Phone bookings:** use **New appointment**. Free times already respect opening hours, holidays, blocks and existing bookings.
4. **After each visit:** mark **Completed**, or **No-show** if the patient didn't come.

## What each status means

| Status | Meaning | Slot |
|---|---|---|
| Pending | Online request, not yet confirmed by the clinic | Reserved |
| Confirmed | Time agreed with the patient | Reserved |
| Reschedule requested | A new time must be agreed | Reserved until moved or cancelled |
| Completed | Visit took place | — |
| Cancelled | Cancelled by patient or clinic | **Released** |
| Rejected | Request could not be offered | **Released** |
| No-show | Patient did not attend | Released |

Statuses can only change in the allowed direction. For example, a cancelled appointment can't be confirmed again; create a new appointment instead.

## Schedule, breaks and holidays

- **Schedule** shows one day per chair. Use the arrows or pick a date.
- **Block time** (staff and owner): for meetings or a short absence. Choose the date, start and end (on the appointment grid), the chair (or all chairs) and a reason. Booked times can't be blocked; you'll see which patients are in the way.
- **Holidays and closures** (owner): add a date range, all day or part of the day. **Existing appointments are not cancelled automatically**; a list of affected patients appears so you can call them.

## Enquiries

Messages from the website's contact form. Open one, call or reply to the patient, add a note, and set the status (*In progress* → *Resolved*). Messages that look like spam are filed as **Spam** automatically and deleted after 30 days. Check the spam filter occasionally in case a real message ended up there.

## Notifications

The system records every email it tries to send. If email isn't set up yet, you'll see "Email not set up". Failed emails are retried automatically; you can also press **Retry now**.

## Clinic settings (owner)

- **Clinic and doctor:** only enter verified details (qualifications exactly as on the registration certificate).
- **Opening hours:** add one or more ranges per day; the gap between ranges is a break. Days with no range are closed. **Online booking only opens once at least one day has hours.**
- **Online booking rules:** appointment length, number of chairs, minimum notice, how far ahead patients can book, and *request* vs *instant* mode. Changing the appointment length doesn't move existing appointments.
- **WhatsApp:** tick "Show WhatsApp buttons" only if the clinic answers WhatsApp on that number.
- **Notifications:** staff alert emails (up to 5) and which emails patients receive.
- **Legal pages:** tick the approval box only after the clinic has reviewed the Privacy Policy and Terms. This removes the "Draft" notice.

If someone else saved settings while you were editing, you'll be asked to reload. This prevents overwriting their changes.

## Services (owner)

Only **publish** treatments the clinic actually offers. *Can be chosen when booking online* controls the booking form. Use general information only: no guarantees of results and no personal medical advice. A service that has appointments can't be deleted; unpublish it instead.

## Staff accounts (owner)

Create an account with name, email and role. A **temporary password is shown once**; pass it on privately. You can change roles, disable accounts (this signs the person out immediately) and reset passwords. There must always be at least one active owner.

## Exports (owner)

Appointment and enquiry CSV exports contain personal information. Download only what you need (max 92 days), store the file securely, and delete it when no longer needed. Each export is recorded in the audit log.

## Privacy reminders

- Don't write detailed medical history in notes. Notes are for scheduling and contact information.
- Mobile numbers are partly hidden in lists on purpose; open the record only when you need it.
- Treat every patient detail as confidential.
