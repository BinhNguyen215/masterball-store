type TournamentFilterValues = {
  game?: string;
  status?: string;
};

export function TournamentFilterForm({
  values,
}: {
  values: TournamentFilterValues;
}) {
  return (
    <form action="/tournaments" className="tournament-filter" method="get">
      <div className="field">
        <label className="field-label" htmlFor="tournament-game">
          Trò chơi
        </label>
        <select defaultValue={values.game ?? ""} id="tournament-game" name="game">
          <option value="">Tất cả</option>
          <option value="pokemon">Pokémon TCG</option>
          <option value="riftbound">Riftbound TCG</option>
          <option value="other">TCG khác</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="tournament-status">
          Trạng thái
        </label>
        <select
          defaultValue={values.status ?? "upcoming"}
          id="tournament-status"
          name="status"
        >
          <option value="upcoming">Sắp diễn ra</option>
          <option value="open">Đang diễn ra</option>
          <option value="ended">Đã kết thúc</option>
          <option value="all">Tất cả</option>
        </select>
      </div>
      <button className="button button--primary" type="submit">
        Xem lịch phù hợp
      </button>
    </form>
  );
}
