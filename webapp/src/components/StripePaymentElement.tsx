import { useEffect, useState, useRef } from "react";
import { getStripeConfigTyped } from "../api/client";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe, StripeElements, StripePaymentElement as StripePaymentElementInstance } from "@stripe/stripe-js";

export interface StripePaymentElementHandle {
  isReady: boolean;
  isProcessing: boolean;
  error: string | null;
  processPayment: () => Promise<boolean>;
  stripeAvailable: boolean;
}

export interface StripePaymentElementProps {
  clientSecret: string | null;
  onPaymentStart?: () => void;
  onPaymentSuccess?: () => void;
  onPaymentError?: (error: string) => void;
  onError?: (error: string | null) => void;
}

export default function StripePaymentElement({
  clientSecret,
  onPaymentStart,
  onPaymentSuccess,
  onPaymentError,
  onError,
}: StripePaymentElementProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let paymentElement: StripePaymentElementInstance | null = null;

    if (!clientSecret) {
      return;
    }

    setError(null);

    (async () => {
      try {
        const config = await getStripeConfigTyped();
        const publishableKey = config.publishableKey;
        if (!publishableKey) {
          const msg = "Stripe is not configured. Using stub payment instead.";
          setError(msg);
          onError?.(null);
          return;
        }

        const s = await loadStripe(publishableKey);
        if (!s || cancelled) return;

        const els = s.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
          },
        });

        paymentElement = els.create("payment", {
          layout: "tabs",
        });
        paymentElement.mount("#payment-element");

        setStripe(s);
        setElements(els);
        setIsReady(true);
      } catch (err: any) {
        if (!cancelled) {
          const msg = err.message || "Failed to initialize payment form";
          setError(msg);
          onError?.(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      paymentElement?.unmount();
    };
  }, [clientSecret, onError]);

  async function processPayment() {
    if (!stripe || !elements || !clientSecret) {
      return false;
    }
    setError(null);
    if (onPaymentStart) onPaymentStart();
    setIsProcessing(true);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (stripeError) {
        const msg = stripeError.message || "Payment failed";
        setError(msg);
        if (onPaymentError) onPaymentError(msg);
        return false;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        if (onPaymentSuccess) onPaymentSuccess();
        return true;
      }

      return false;
    } catch (err: any) {
      const msg = err.message || "Payment failed";
      setError(msg);
      if (onPaymentError) onPaymentError(msg);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <div className="stripe-payment-element">
      <div id="payment-element" className="w-full min-h-[120px]" />
      {error && (
        <p className="mt-2 text-xs status-error-text">{error}</p>
      )}
      <div className="sr-only" aria-live="polite">
        {isProcessing ? "Processing payment..." : isReady ? "Payment form ready" : "Loading payment form..."}
      </div>
    </div>
  );
}
