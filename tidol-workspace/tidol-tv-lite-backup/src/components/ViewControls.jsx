export default function ViewControls({ viewMode, setViewMode }) {
    return (
        <div className="view-controls">
            <span>Recents ▼</span>
            <div className="toggles">
                <button
                    onClick={() => setViewMode("list")}
                    className={viewMode === "list" ? "active" : ""}
                >☰</button>
                <button
                    onClick={() => setViewMode("grid")}
                    className={viewMode === "grid" ? "active" : ""}
                >⊞</button>
            </div>
        </div>
    );
}
