export default function LibraryItem({
    title,
    subtitle,
    image,
    onClick,
    viewMode = "list",
}) {
    return (
        <div className={`lib-item ${viewMode}`} onClick={onClick}>
            <img src={image} className="lib-item-img" />
            <div className="lib-item-info">
                <h4>{title}</h4>
                <p>{subtitle}</p>
            </div>
        </div>
    );
}
