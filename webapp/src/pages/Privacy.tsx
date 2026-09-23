import { Link } from "react-router-dom";
import LegalPage from "../components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-tertiary">
        Effective date: September 1, 2026
      </p>

      <p>
        InvoiceFlow ("we", "us", or "our") operates the InvoiceFlow service
        (the "Service"). This Privacy Policy explains how we collect, use,
        disclose, and protect your information when you use our website,
        applications, and services.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        We collect information you provide directly to us and information
        gathered automatically during your use of the Service.
      </p>

      <h3>Information you provide</h3>
      <ul>
        <li>
          <strong>Account information:</strong> When you register, we collect
          your name, email address, password, and business details (company
          name, address, tax identification, logo).
        </li>
        <li>
          <strong>Content you create:</strong> Invoices, quotes, customers,
          products, expenses, projects, templates, and related data that you
          enter or upload.
        </li>
        <li>
          <strong>Communication:</strong> Any information you include when you
          contact us, respond to surveys, or communicate with other users.
        </li>
        <li>
          <strong>Payment information:</strong> We process payments through
          third-party providers (e.g., Stripe). We do not store your full
          card number; the payment processor does.
        </li>
      </ul>

      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage data:</strong> Pages visited, features used, time
          spent, actions taken, and error reports.
        </li>
        <li>
          <strong>Device and connection data:</strong> IP address, browser
          type, operating system, referring URLs, and device identifiers.
        </li>
        <li>
          <strong>Cookies and similar tech:</strong> We use cookies and similar
          tracking technologies to operate the Service and remember your
          preferences. See our Cookie section below.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Create, store, and manage your account.</li>
        <li>Generate, send, and track invoices and related documents.</li>
        <li>Process payments and prevent fraud.</li>
        <li>Provide customer support and respond to your requests.</li>
        <li>Send service-related notifications (e.g., due-date reminders).</li>
        <li>Improve the Service, develop new features, and analyze usage.</li>
        <li>Detect and prevent abuse, fraud, and security incidents.</li>
        <li>Communicate with you about the Service, subject to applicable law.</li>
      </ul>

      <h2>3. Cookies</h2>
      <p>
        We use both session and persistent cookies. Session cookies are
        deleted when you close your browser. Persistent cookies remain and
        help us recognize you across sessions unless you delete them.
      </p>
      <p>
        You can control cookies through your browser settings. Disabling
        cookies may limit your ability to use certain features of the Service.
      </p>

      <h2>4. Data Retention</h2>
      <p>
        We retain information for as long as your account is active or as
        needed to provide the Service. If you close your account, we retain
        data for a reasonable period to fulfill legal obligations, resolve
        disputes, and enforce our agreements.
      </p>

      <h2>5. Your Rights and Choices</h2>
      <p>You may have the right to:</p>
      <ul>
        <li>Access, correct, or delete your personal information.</li>
        <li>Export your data in a portable format.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Lodge a complaint with a supervisory authority.</li>
      </ul>
      <p>
        To make such requests, contact us at{" "}
        <a href="mailto:support@invoiceflow.com">support@invoiceflow.com</a>.
        We may need to verify your identity before fulfilling your request.
      </p>

      <h2>6. Sharing Your Information</h2>
      <p>We do not sell your personal information. We share information only with:</p>
      <ul>
        <li>
          <strong>Service providers:</strong> Third parties that perform
          services on our behalf (payment processing, email delivery,
          analytics, hosting, support).
        </li>
        <li>
          <strong>When required by law:</strong> To comply with legal
          obligations, respond to lawful requests, or protect rights and safety.
        </li>
        <li>
          <strong>Business transfers:</strong> In connection with a merger,
          acquisition, or sale of assets, subject to the receiving party being
          bound by this Privacy Policy.
        </li>
      </ul>

      <h2>7. Security</h2>
      <p>
        We implement and maintain reasonable security measures designed to
        protect your information, including encryption at rest and in transit
        (TLS), access controls, and regular security testing. However, no
        method of transmission over the internet is completely secure.
      </p>

      <h2>8. International Data Transfers</h2>
      <p>
        The Service is hosted in the United States. If you are located outside
        the U.S., your information may be transferred to, stored, and processed
        in a jurisdiction with different data-protection laws.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        The Service is not intended for children under 13. We do not knowingly
        collect personal information from children under 13.
      </p>

      <h2>10. Links to Other Sites</h2>
      <p>
        The Service may contain links to third-party websites or services.
        This Privacy Policy does not apply to those sites. We are not
        responsible for their content, privacy policies, or practices.
      </p>

      <h2>11. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post
        changes here and, where appropriate, notify you. Your continued use
        of the Service after changes constitutes acceptance.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, contact us at:
      </p>
      <p>
        InvoiceFlow<br />
        Email: <a href="mailto:support@invoiceflow.com">support@invoiceflow.com</a>
      </p>
      <p>
        <Link to="/terms">Read our Terms of Service</Link>
      </p>
    </LegalPage>
  );
}
