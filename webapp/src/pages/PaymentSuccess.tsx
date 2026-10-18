import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useMetaTags } from "@/hooks/useMetaTags";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  useMetaTags({
    title: "Payment Successful — DocForge",
    description: "Your payment has been processed successfully.",
    noIndex: true,
  });

  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-16 w-16 text-success" />
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">Payment Successful</h1>
        <p className="text-secondary mb-6">
          Thank you for your payment. The invoice has been updated and a receipt has been sent to your email.
        </p>
        {token && (
          <Link
            to={`/invoice/${token}`}
            className="inline-flex items-center justify-center px-6 py-2 bg-primary-action text-on-primary rounded-md font-medium hover:bg-primary-hover transition-colors"
          >
            View Invoice
          </Link>
        )}
      </div>
    </div>
  );
}

