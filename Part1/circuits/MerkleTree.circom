pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/switcher.circom";

template CheckRoot(n) { // compute the root of a MerkleTree of n Levels 
    signal input leaves[2**n];
    signal output root;

    //[assignment] insert your code here to calculate the Merkle root from 2^n leaves
    assert(n >= 1); // doesn't work for n = 0
    
    /*
      Tested following settings
      root = 14629452129687363793084585378194807561782241384488665279773588974567494940279 for 8 leaves [1,2,3,4,5,6,7,8]
      root = 3330844108758711782672220159612173083623710937399719017074673646455206473965 for 4 leaves [1,2,3,4]
      root = 7853200120776062878684798364095072458815029376092732009249414926327459813530 for 2 leaves [1,2]
    */

    // we have 2**(n-1) + 2**(n-2) + .. + 2**0 = (2**n) - 1 total hashes
    component hashes[(2**n) - 1];

    // build the hashes of the 2**n leaves that result in 2**(n-1) hashes
    for (var i = 0; i < 2**(n-1); i++){
      hashes[i] = Poseidon(2);
      hashes[i].inputs[0] <== leaves[2*i];
      hashes[i].inputs[1] <== leaves[2*i+1];
    }

    // index of first input hashs 
    var idx_in = 0;

    // idx is the position of the parent hash, 
    // that calculates the hash of the two childrens: hashes[idx_in] and hashes[idx_in + 1]
    for (var idx = 2**(n-1); idx < (2**n - 1); idx++){
        hashes[idx] = Poseidon(2);
        hashes[idx].inputs[0] <== hashes[idx_in ].out;
        hashes[idx].inputs[1] <== hashes[idx_in + 1].out;
        idx_in += 2; // take 2 hashes as input
    }

    root <== hashes[((2**n) - 1) - 1].out; // last element of hash array is the root    
    log(root); // for simple testing
}

template MerkleTreeInclusionProof(n) {
    signal input leaf;
    signal input path_elements[n];
    signal input path_index[n]; // path index are 0's and 1's indicating whether the current element is on the left or right
    signal output root; // note that this is an OUTPUT signal

    //[assignment] insert your code here to compute the root from a leaf and elements along the path
    
    // poseidon hashes
    component hashes[n];
    // switchers for ordering of the hash elemen
    component switchers[n];

  
    switchers[0] = Switcher();
    // path_index decides order of hash input elements
    switchers[0].sel <== path_index[0];
    switchers[0].L <== leaf;
    switchers[0].R <== path_elements[0];

    hashes[0] = Poseidon(2);
    hashes[0].inputs[0] <== switchers[0].outL;
    hashes[0].inputs[1] <== switchers[0].outR;

    for (var i = 1; i < n; i++){
      switchers[i] = Switcher();
      switchers[i].sel <== path_index[i];
      switchers[i].L <== hashes[i-1].out;
      switchers[i].R <== path_elements[i] ;

      hashes[i] = Poseidon(2);
      hashes[i].inputs[0] <== switchers[i].outL;
      hashes[i].inputs[1] <== switchers[i].outR;
    }

    root <== hashes[n-1].out;
}