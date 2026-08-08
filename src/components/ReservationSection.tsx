import { useState } from "react";
import { whatsappUrl } from "@/data/site";

export function ReservationSection() {
  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    date: "",
    heure: "",
    personnes: "",
    message: "",
  });
  const [error, setError] = useState("");

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom || !form.telephone || !form.date || !form.heure || !form.personnes) {
      setError("Merci de remplir tous les champs obligatoires.");
      return;
    }
    setError("");
    const message = [
      "Bonjour LE PACHA,",
      "Je souhaite réserver une table.",
      "",
      `Nom : ${form.nom}`,
      `Téléphone : ${form.telephone}`,
      `Date : ${form.date}`,
      `Heure : ${form.heure}`,
      `Nombre de personnes : ${form.personnes}`,
      `Message : ${form.message || "-"}`,
    ].join("\n");
    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  }

  return (
    <section id="reservation" className="section-pad bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
            Sur place
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
            Réservez votre table
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Indiquez vos informations, votre demande est envoyée directement au restaurant sur
            WhatsApp pour confirmation.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom *" value={form.nom} onChange={set("nom")} />
            <Field label="Téléphone *" type="tel" value={form.telephone} onChange={set("telephone")} />
            <Field label="Date *" type="date" value={form.date} onChange={set("date")} />
            <Field label="Heure *" type="time" value={form.heure} onChange={set("heure")} />
            <div className="sm:col-span-2">
              <Field
                label="Nombre de personnes *"
                type="number"
                value={form.personnes}
                onChange={set("personnes")}
              />
            </div>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Message (facultatif)</span>
              <textarea
                rows={3}
                value={form.message}
                onChange={set("message")}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          {error && <p className="mt-3 text-xs font-medium text-destructive">{error}</p>}
          <button
            type="submit"
            className="mt-5 w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Réserver
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}