export default function ResultTable({
  entries,
}) {
  if (!entries.length) return null;

  return (
    <table>
      <thead>
        <tr>
          <th>NO</th>
          <th>Job</th>
          <th>Sn No</th>
          <th>Actual Weight</th>
          <th>After Core Weight</th>
          <th>Core Scrap</th>
          <th>X and Y</th>
        </tr>
      </thead>

      <tbody>
        {entries.map((entry, index) => (
          <tr key={index}>
            <td>{entry.NO}</td>

            <td>{entry.Job}</td>

            <td>{entry.Sn_No}</td>

            <td>
              {entry.Actual_Weight}
            </td>

            <td>
              {
                entry.After_Core_Weight
              }
            </td>

            <td>
              {entry.Core_Scrap}
            </td>

            <td>
              {entry.X_and_Y}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
