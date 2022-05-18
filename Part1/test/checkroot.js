const path = require("path");
const wasm_tester = require("circom_tester").wasm;
const buildPoseidon = require("circomlibjs").buildPoseidon;
//const F = require("circomlibjs").babyjub.F;

const buildBabyJub = require("circomlibjs").buildBabyjub;

describe("Check circuit", function () {
  let circuit;
  let babyJub;
  let F;
  let poseideonHasher;
  
  this.timeout(10000000);

  before( async() => {
      babyJub = await buildBabyJub();
      F = babyJub.F;
      poseideonHasher = await buildPoseidon();
      circuit = await wasm_tester(path.join(__dirname, "../circuits", "checkroot.circom"));
  });

  console.log("Dirname: " + __dirname);

  it("Check if CheckRoot correctly calculates root ", async () => {
      const input={
          leaves: [1, 2, 3, 4, 5, 6, 7, 8]
      };
      console.log(input);


      // root = 14629452129687363793084585378194807561782241384488665279773588974567494940279 for 8 leaves [1,2,3,4,5,6,7,8]
      // root = 3330844108758711782672220159612173083623710937399719017074673646455206473965 for 4 leaves [1,2,3,4]
      // root = 7853200120776062878684798364095072458815029376092732009249414926327459813530 for 2 leaves [1,2]

      
      await circuit.calculateWitness(input, true);
      //console.log(w);
  });

});