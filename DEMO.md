# Demo video script (3-5 minutes)

1. **(20s) Problem** - "Club events live in chat. Capped workshops overbook, and cancelled seats
   never reach the waitlist. Quorum is Luma for Reinforce."
2. **(30s) Discovery** - open https://quorum-wu5r.onrender.com without logging in: search, upcoming/past, badges
   showing spots left vs waitlist.
3. **(30s) Sign-in** - click Continue with Google, show that the account chooser is restricted to
   @sst.scaler.com, land back logged in. If you have a personal Gmail handy,
   show the server rejecting it ("Sign-in is restricted to @sst.scaler.com
   Google accounts") - that rejection IS the feature.
4. **(40s) RSVP + waitlist** - RSVP to an open seeded event (confirmed), then open the full
   seeded event ("Tiny Transformers from Scratch") and join the waitlist; show the exact position.
   (You can RSVP to seeded events - you are not their organizer - so this works solo.)
5. **(40s) Waitlist promotion** - this needs a second real SST account, because you cannot RSVP
   to your own event and seeded demo users cannot log in. Pick one:
   - **Two-person take (best):** a clubmate signs in, joins the waitlist on YOUR event (or a
     shared one); another "going" member cancels - reload: the clubmate is promoted automatically.
   - **Solo take (honest):** stay waitlisted on the full seeded event, narrate the invariant
     ("a cancellation or a capacity raise promotes the head of the waitlist in the same
     transaction - it cannot be skipped"), then show it enforced: open `server/test/api.test.js`
     / the e2e suite and run `npm test` - the promotion test passes against a real Postgres.
     Do not fake the promotion with UI edits.
6. **(40s) Organizer console** - create an event live (title, times, capacity), view the attendee
   list, edit capacity, show the validation when shrinking below the going count. (All verified
   working on the live deployment.) Cancel the throwaway event afterward so it leaves no trace.
7. **(20s) Close** - "The engineering that matters: transactions make the last seat unsellable
   twice, and the waitlist can never be skipped."

Upload the video to Google Drive ("anyone with the link can view") and paste the link here and in
the submission form:

**Video link:** _paste here_
