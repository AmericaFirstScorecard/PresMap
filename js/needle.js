const arcSegs = [
  { label: "Very likely Bush", start: -90, end: -60 },
  { label: "Likely Bush", start: -60, end: -30 },
  { label: "Lean Bush", start: -30, end: -10 },
  { label: "Tossup", start: -10, end: 10 },
  { label: "Lean Gore", start: 10, end: 30 },
  { label: "Likely Gore", start: 30, end: 60 },
  { label: "Very likely Gore", start: 60, end: 90 }
];
const svgCx = 250, svgCy = 154, arcR = 110;

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", r, r, 0, arcSweep, 1, end.x, end.y
  ].join(" ");
}

function polar(cx, cy, r, angleDeg) {
  const angle = (angleDeg-90)*Math.PI/180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function setArcSegments() {
  document.getElementById('arc-vl-bush').setAttribute('d', arcPath(svgCx,svgCy,arcR, -90, -60));
  document.getElementById('arc-l-bush').setAttribute('d', arcPath(svgCx,svgCy,arcR, -60, -30));
  document.getElementById('arc-le-bush').setAttribute('d', arcPath(svgCx,svgCy,arcR, -30, -10));
  document.getElementById('arc-tossup').setAttribute('d', arcPath(svgCx,svgCy,arcR, -10, 10));
  document.getElementById('arc-le-gore').setAttribute('d', arcPath(svgCx,svgCy,arcR, 10, 30));
  document.getElementById('arc-l-gore').setAttribute('d', arcPath(svgCx,svgCy,arcR, 30, 60));
  document.getElementById('arc-vl-gore').setAttribute('d', arcPath(svgCx,svgCy,arcR, 60, 90));
}
