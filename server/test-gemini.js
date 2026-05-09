require("dotenv").config();

const { convertToJSON } = require("./services/gemini");

const SAMPLE_MARKDOWN = `
| NO | Job | Sn No | Actual Weight | After Core Weight | Core Scrap | X and Y |
|----|------|------|------|------|------|------|
| 1 | J-1042 | SN-00421 | 12.50 | 11.80 | 0.70 | 1.20 |
| 2 | J-1043 | SN-00422 | 13.00 |  | 0.85 |  |
`;

(async () => {
  try {
    const result = await convertToJSON(SAMPLE_MARKDOWN);

    console.log(
      JSON.stringify(result, null, 2)
    );
  } catch (err) {
    console.error(err.message);
  }
})();
