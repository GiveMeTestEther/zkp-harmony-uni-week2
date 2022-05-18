//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { PoseidonT3 } from "./Poseidon.sol"; //an existing library to perform Poseidon hash on solidity
import "./verifier.sol"; //inherits with the MerkleTreeInclusionProof verifier contract

import "hardhat/console.sol";

contract MerkleTree is Verifier {
    uint256[] public hashes; // the Merkle tree in flattened array form
    uint256 public index = 0; // the current index of the first unfilled leaf
    uint256 public root; // the current Merkle root

    constructor() {
        // [assignment] initialize a Merkle tree of 8 with blank leaves
        // TODO: smarter
        uint256 hashEmptyValues = PoseidonT3.poseidon([uint256(0),uint256(0)]);
        uint256 hashOfEmptyHashes = PoseidonT3.poseidon([hashEmptyValues,hashEmptyValues]);
        hashes = [0, 0, 0, 0, 0, 0, 0, 0, hashEmptyValues, hashEmptyValues, hashEmptyValues, hashEmptyValues, hashOfEmptyHashes, hashOfEmptyHashes, PoseidonT3.poseidon([hashOfEmptyHashes,hashOfEmptyHashes])];
        // last element is the root
        root = hashes[(2**4) - 2 ];
    }

    function insertLeaf(uint256 hashedLeaf) public returns (uint256) {
        // [assignment] insert a hashed leaf into the Merkle tree

        // TODO: not hardcode levels?
        uint256 levels = 3;
        require(index != 2**3, "Level is full");

        uint256 currentHash = hashedLeaf;
        uint256 currentLevelIndex = index;
        uint256 currentLevelStartIndex = 0;

        for(uint i = 0; i < levels; i++){
          if (currentLevelIndex % 2 == 0){ // index is the left element
            hashes[currentLevelStartIndex + currentLevelIndex ]  = currentHash; // update the current hash value
            currentHash = PoseidonT3.poseidon([currentHash, hashes[currentLevelStartIndex + currentLevelIndex + 1]]); // take pair and calculate hash for parent
          } else { // index is the right element
            hashes[currentLevelStartIndex + currentLevelIndex] = currentHash; // update the current hash value
            currentHash = PoseidonT3.poseidon([hashes[currentLevelStartIndex + currentLevelIndex - 1], currentHash]); // take pair and calculate hash for parent
          }
          
          currentLevelIndex /= 2; // this give the index of
          currentLevelStartIndex += 2**(levels - i); // we sum up all the total level elemnts "to jump" on the higher level of the tree
        }

        // increment index for next free hashed leaf index
        index++;

        // currentHash is the merkle tree root, bcs we went only up to level 1 but on level 0 is the merkle root
        root = hashes[(2**4) - 2] = currentHash;

        return root;
    }

    function verify(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[1] memory input
        ) public view returns (bool) {

        // [assignment] verify an inclusion proof and check that the proof root matches current root
        return  input[0] == root && super.verifyProof(a, b, c, input);
    }
}
