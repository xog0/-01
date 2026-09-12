export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-white p-10 text-center text-sm text-muted">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[42rem] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper-2/60 text-start">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-start text-xs font-semibold text-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={index} className="transition-colors hover:bg-paper-2/40">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3.5 align-middle text-navy-900">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
