# Lab 2 Reviewer Evidence

## Reviewer Identity

* **Name:** Chanya Tinnaphopworachot
* **Student ID:** 67070503456
* **GitHub:** [Chanya-Grace-2546](https://github.com/Chanya-Grace-2546)

## Peer Review Partners

* **I reviewed:** Phoo Phoo Thit (67070503455) — [GitHub](https://github.com/thit3455)
* **Reviewed my work:** Thin Myat Yati Htun (67070503485) — [GitHub](https://github.com/tm-georgia)

---

## Reviews Given

### Lab 2 Engineering Contract

* **PR:** [PR #13](https://github.com/thit3455/toktickit/pull/13)
* **Comment:** "Your spec and test plan are clear enough to move forward."
* **Response:** "ok, I will move forward."
* **Result:** Approved

### Development Requester Context

* **PR:** [PR #21](https://github.com/thit3455/toktickit/pull/21)
* **Comment:** You seem to have forgotten to remove the Category list from Lab 1. Since this screen is now the TokTickIT Development Requester Selection screen, I think the previous “Check System” and “Supported Request Categories” sections should be removed.
* **Response:** Ahhhhh.. I see it , I forgot to do this , now I removed it.
* **Comment:** Everything looks fine now.Approve.
* **Result:** Changes resolved

### Ticket Creation

* **PR:** [PR #22](https://github.com/thit3455/toktickit/pull/22)
* **Comment:** "Your create ticket UI meets requirement and server works well."
* **Result:** Approved

### My Tickets

* **PR:** [PR #23](https://github.com/thit3455/toktickit/pull/23)
* **Comment:** The ticket creation form is also appearing on the “My Tickets” page. I think the “My Tickets” page should only display the user's existing tickets while the ticket creation form should only appear on the “Create Ticket” page. Could you please check this?
* **Response:** Sorry , I see my UI , I will move to fixing stage to prepare for this
* **Response:** I remove the duplicate green Create Ticket button on the right of My Tickets but I think keeping search/filter/sort/pagination because the PDF requires them
* **My Response:** Oh, sorry! I misunderstood. I thought it was a form for entering information to create a ticket but I understand now that it is for filtering. You don't need to fix anything.

* **Result:** Resolved

### Ticket Detail and Attachments

* **PR:** [PR #24](https://github.com/thit3455/toktickit/pull/24)
* **Comment:** "The implementation looks good, and the API tests cover the main functionality."
* **Result:** Approved

### Testing and Review Evidence

* **PR:** [PR #25](https://github.com/thit3455/toktickit/pull/25)
* **Result:** Approved

---

## Reviews Received

### Lab 2 Specification and Test Design

* **PR:** [PR #17](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/17)
* **Reviewer:** Thin Myat Yati Htun
* **Comment:** "The file changes look good and are enough for the Lab 2 requirements."
* **Result:** Approved

### Requester Context and Selection

* **PR:** [PR #18](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/18)
* **Reviewer:** Thin Myat Yati Htun
* **Comment:** "Your work looks all fine. Keep going."
* **Result:** Approved

### Ticket Creation

* **PR:** [PR #20](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/20)
* **Reviewer:** Thin Myat Yati Htun
**Comment:** "Your work seems correct. Great job!"
* **Result:** Approved

### My Tickets

* **PR:** [PR #21](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/21)
* **Reviewer:** Thin Myat Yati Htun
* **Comment:** "Nice work on issue 5! Everything for the tickets list checks out cleanly."
* **Result:** Approved

### Ticket Detail and Attachments

* **PR:** [PR #22](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/22)
* **Reviewer:** Thin Myat Yati Htun
* **Comment:** "All look fine and work correctly."
* **Result:** Approved

### E2E Testing
* **PR:** [PR #24] (https://github.com/Chanya-Grace-2546/TokTick_3456/pull/24)* **Reviewer:** Thin Myat Yati Htun
* **Comment:** "You are doing a good job. But I don't see loading in yours as lab pdf file. Next, I found that there is no It priority in your create ticket."
* **Response:** "Turns out it does load, but the API might be working too fast! I'm adding a slight delay to make the loading state visible. Also, for 'IT priority', requesters shouldn't need to fill that out, so I'm keeping it for IT staff only and having the backend default it to Medium. Let's look at the ticket details.So, I'll create a separate issue to handle that.""when I think again I find it is ridiculous to intentionally wait 2 seconds before loading requesters.So I am not gonna do this."
