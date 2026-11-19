export const theme = { colors: { canvas: "#F7F6F0", paper: "#FFFFFF", ink: "#202923", muted: "#748078", line: "#E7E9E0", green: "#286B4D", greenDark: "#194D39", greenSoft: "#E8F2E9", yellowSoft: "#FFF4D7", coralSoft: "#FCEBE5", blueSoft: "#EAF2F4", danger: "#B94B3E" }, radius: { card: 22, field: 13 } };
export const currency = (value: number | string | null | undefined) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
export const colors=theme.colors;
export const money=currency;
