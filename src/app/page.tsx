import { getPeopleWithBalances } from "@/lib/actions/person";
import { createPerson } from "@/lib/actions/person";
import { createDebt } from "@/lib/actions/debt";
import { createPayment } from "@/lib/actions/payment";
import { createCreditCard, getCreditCards } from "@/lib/actions/credit-card";
import { signOutAction } from "@/lib/actions/auth";

export default async function Home() {
  const [people, creditCards] = await Promise.all([
    getPeopleWithBalances(),
    getCreditCards(),
  ]);

  const totalToReceive = people.reduce((sum, p) => sum + p.totalOwed, 0);

  return (
    <main>
      <header>
        <h1>Debt Tracker</h1>
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </header>

      <section>
        <h2>Total to receive: {totalToReceive.toFixed(2)}</h2>
      </section>

      <section>
        <h3>Add new person</h3>
        <form action={createPerson}>
          <input type="text" name="name" placeholder="Name" required />
          <button type="submit">Add person</button>
        </form>
      </section>

      <section>
        <h3>Add new credit card</h3>
        <form action={createCreditCard}>
          <input type="text" name="label" placeholder="Card label (ex: Nubank)" required />
          <button type="submit">Add card</button>
        </form>
      </section>

      <section>
        <h3>People</h3>
        {people.map((person) => (
          <div key={person.id}>
            <h4>{person.name}</h4>
            <p>Owes: {person.totalOwed.toFixed(2)}</p>
            <p>Access code: {person.accessCode}</p>

            <ul>
              {person.debts.map((debt) => (
                <li key={debt.id} style={{ opacity: debt.isCovered ? 0.5 : 1 }}>
                  {debt.description} — {debt.amount.toFixed(2)} —{" "}
                  {debt.date.toLocaleDateString()}{" "}
                  {debt.isCovered ? "(covered)" : ""}
                </li>
              ))}
            </ul>

            <form action={createDebt}>
              <input type="hidden" name="personId" value={person.id} />
              <input type="number" name="amount" step="0.01" placeholder="Amount" required />
              <input type="text" name="description" placeholder="Description" required />
              <input type="date" name="date" required />
              <select name="creditCardId">
                <option value="">No card</option>
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.label}
                  </option>
                ))}
              </select>
              <button type="submit">Add debt</button>
            </form>

            <form action={createPayment}>
              <input type="hidden" name="personId" value={person.id} />
              <input type="number" name="amount" step="0.01" placeholder="Amount" required />
              <input type="date" name="date" required />
              <button type="submit">Add payment</button>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}