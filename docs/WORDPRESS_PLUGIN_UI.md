# WordPress Plugin UI Spec

## Admin
- WP Admin menu label: **Chatbot Ecom**
- Settings:
  - Backend API URL (text input)
  - Enable/Disable (toggle)

## Storefront Widget
- Floating launcher + expandable panel.
- Message list with user/assistant bubbles.
- Input composer (enter-to-send).
- Calls backend `POST /chat` and renders `reply`.
- If `escalation: true`, shows an escalation form:
  - Name (optional)
  - Email (optional)
  - Note (optional)

