import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const data = [
  { name: 'Lun', sesiones: 4 },
  { name: 'Mar', sesiones: 7 },
  { name: 'Mie', sesiones: 5 },
  { name: 'Jue', sesiones: 8 },
  { name: 'Vie', sesiones: 6 }
];

function StatsChart() {
  return (
    <div className="card-panel chart-panel">
      <div className="panel-heading">
        <h3>Actividad semanal</h3>
        <p>Base inicial con `recharts` para métricas del agente.</p>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#0d6efd" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="sesiones" stroke="#0d6efd" fill="url(#fillSessions)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default StatsChart;
