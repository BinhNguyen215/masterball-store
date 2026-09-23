import type { StorefrontCopy } from "@/i18n";

type TournamentFilterValues = {
  game?: string;
  status?: string;
};

type TournamentFilterFormProps = {
  copy: StorefrontCopy["tournaments"]["filter"];
  statusLabels: StorefrontCopy["tournaments"]["status"];
  values: TournamentFilterValues;
};

export function TournamentFilterForm({
  copy,
  statusLabels,
  values,
}: TournamentFilterFormProps) {
  return (
    <form action="/tournaments" className="tournament-filter" method="get">
      <div className="field">
        <label className="field-label" htmlFor="tournament-game">
          {copy.game}
        </label>
        <select defaultValue={values.game ?? ""} id="tournament-game" name="game">
          <option value="">{copy.all}</option>
          <option value="pokemon">{copy.gamePokemon}</option>
          <option value="riftbound">{copy.gameRiftbound}</option>
          <option value="other">{copy.gameOther}</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="tournament-status">
          {copy.status}
        </label>
        <select
          defaultValue={values.status ?? "upcoming"}
          id="tournament-status"
          name="status"
        >
          <option value="upcoming">{statusLabels.upcoming}</option>
          <option value="open">{statusLabels.open}</option>
          <option value="ended">{statusLabels.ended}</option>
          <option value="all">{copy.all}</option>
        </select>
      </div>
      <button className="button button--primary" type="submit">
        {copy.submit}
      </button>
    </form>
  );
}
