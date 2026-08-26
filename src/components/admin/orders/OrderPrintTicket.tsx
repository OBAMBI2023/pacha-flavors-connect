import { Fragment } from "react";
import type { DbRestaurant } from "@/lib/menu-db";
import type { OrderDetail } from "@/lib/orders-db";
import { formatMoney as money } from "@/lib/currency";
import { deliveryAddressLine, fulfillmentLabel } from "./orderStatusMeta";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "./paymentStatusMeta";

/**
 * Print-only order ticket for the Admin dashboard. Rendered off-screen at
 * all times (see `.order-print-ticket` in styles.css) and only made visible
 * -- to the exclusion of the rest of the dashboard -- inside `@media print`,
 * so `window.print()` from OrderDetailSheet produces just this receipt.
 * Sized for an 80mm thermal roll, capped with `max-width: 100%` so it also
 * prints cleanly (centered, not stretched) on A4. Purely presentational --
 * consumes an already-fetched OrderDetail, no new data source.
 */
export function OrderPrintTicket({
  order,
  restaurant,
}: {
  order: OrderDetail | null;
  restaurant: DbRestaurant | null;
}) {
  if (!order) return null;

  const createdAt = new Date(order.created_at);
  const addressLine = order.fulfillment_type === "delivery" ? deliveryAddressLine(order) : null;
  const instructions = [order.customer_notes, order.delivery_instructions].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  return (
    <div className="order-print-ticket" aria-hidden="true">
      <div className="order-print-ticket__inner">
        <header className="order-print-ticket__header">
          {restaurant?.logo_url && <img src={restaurant.logo_url} alt="" className="order-print-ticket__logo" />}
          <p className="order-print-ticket__name">{restaurant?.name ?? "Restaurant"}</p>
          {restaurant?.address && <p>{restaurant.address}</p>}
          {restaurant?.phone && <p>Tél : {restaurant.phone}</p>}
        </header>

        <div className="order-print-ticket__rule" />

        <p className="order-print-ticket__order-number">Commande #{order.order_number}</p>
        <p>
          {createdAt.toLocaleDateString("fr-FR")} à {createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p>{fulfillmentLabel(order.fulfillment_type)}</p>

        <div className="order-print-ticket__rule" />

        <p>
          <strong>Client :</strong> {order.customer_name}
        </p>
        <p>
          <strong>Tél :</strong> {order.customer_phone}
        </p>
        {addressLine && (
          <p>
            <strong>Adresse :</strong> {addressLine}
          </p>
        )}
        {order.fulfillment_type === "delivery" && order.delivery_landmark && (
          <p>
            <strong>Repère :</strong> {order.delivery_landmark}
          </p>
        )}

        <div className="order-print-ticket__rule" />

        <ul className="order-print-ticket__items">
          {order.items.map((item) => (
            <li key={item.id} className="order-print-ticket__item">
              <div className="order-print-ticket__row">
                <span>
                  {item.quantity} × {item.product_name_snapshot}
                </span>
                <span>{money(item.line_total, order.currency)}</span>
              </div>
              {item.options.map((opt) => (
                <div key={opt.id} className="order-print-ticket__option">
                  - {opt.option_group_name_snapshot} : {opt.option_name_snapshot}
                  {opt.extra_price_snapshot > 0 ? ` (+${money(opt.extra_price_snapshot, order.currency)})` : ""}
                </div>
              ))}
              {item.item_notes && <div className="order-print-ticket__option">Note : {item.item_notes}</div>}
            </li>
          ))}
        </ul>

        <div className="order-print-ticket__rule" />

        <div className="order-print-ticket__totals">
          <div className="order-print-ticket__row">
            <span>Sous-total</span>
            <span>{money(order.subtotal_amount, order.currency)}</span>
          </div>
          <div className="order-print-ticket__row">
            <span>Livraison</span>
            <span>{money(order.delivery_fee_amount, order.currency)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="order-print-ticket__row">
              <span>Réduction</span>
              <span>-{money(order.discount_amount, order.currency)}</span>
            </div>
          )}
          <div className="order-print-ticket__row order-print-ticket__row--total">
            <span>TOTAL</span>
            <span>{money(order.total_amount, order.currency)}</span>
          </div>
        </div>

        <div className="order-print-ticket__rule" />

        <div className="order-print-ticket__row">
          <span>Paiement</span>
          <span>{PAYMENT_METHOD_LABELS[order.payment_method]}</span>
        </div>
        <div className="order-print-ticket__row">
          <span>Statut</span>
          <span>{PAYMENT_STATUS_LABELS[order.payment_status]}</span>
        </div>

        {order.allergy_information && (
          <>
            <div className="order-print-ticket__rule" />
            <p className="order-print-ticket__allergy">⚠ Allergies : {order.allergy_information}</p>
          </>
        )}

        {instructions.length > 0 && (
          <>
            <div className="order-print-ticket__rule" />
            {instructions.map((note, index) => (
              <Fragment key={index}>
                <p>Instructions : {note}</p>
              </Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
