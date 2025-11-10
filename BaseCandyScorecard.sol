// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BaseCandyScorecard
 * @dev Minimal ERC721-like NFT for Base Candy game scorecards
 * @dev Optimized for Farcaster wallet - no external dependencies
 */
contract BaseCandyScorecard {
    string public name = "Base Candy Scorecard";
    string public symbol = "BASECANDY";
    
    uint256 private _nextTokenId = 1;
    address private _owner;
    
    struct Scorecard {
        uint256 score;
        string playerName;
        uint256 rank;
        string compliment;
        uint256 timestamp;
        address minter;
    }
    
    // Mapping from token ID to scorecard data
    mapping(uint256 => Scorecard) public scorecards;
    
    // Mapping from token ID to owner
    mapping(uint256 => address) private _owners;
    
    // Mapping from owner to token count
    mapping(address => uint256) private _balances;
    
    // Mapping from player address to their token IDs
    mapping(address => uint256[]) private _playerTokens;
    
    event ScorecardMinted(
        address indexed player, 
        uint256 indexed tokenId, 
        uint256 score, 
        string playerName, 
        uint256 rank
    );
    
    constructor() {
        _owner = msg.sender;
    }
    
    /**
     * @dev Mint a new scorecard NFT - SIMPLIFIED FOR FARCASTER
     */
    function mintScorecard(
        uint256 score,
        string calldata playerName,
        uint256 rank,
        string calldata compliment
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        _owners[tokenId] = msg.sender;
        _balances[msg.sender]++;
        
        scorecards[tokenId] = Scorecard({
            score: score,
            playerName: playerName,
            rank: rank,
            compliment: compliment,
            timestamp: block.timestamp,
            minter: msg.sender
        });
        
        _playerTokens[msg.sender].push(tokenId);
        
        emit ScorecardMinted(msg.sender, tokenId, score, playerName, rank);
        
        return tokenId;
    }
    
    /**
     * @dev Get all token IDs owned by a player
     */
    function getPlayerTokens(address player) external view returns (uint256[] memory) {
        return _playerTokens[player];
    }
    
    /**
     * @dev Get scorecard data for a token
     */
    function getScorecard(uint256 tokenId) external view returns (
        uint256 score,
        string memory playerName,
        uint256 rank,
        string memory compliment,
        uint256 timestamp,
        address minter
    ) {
        Scorecard memory card = scorecards[tokenId];
        return (card.score, card.playerName, card.rank, card.compliment, card.timestamp, card.minter);
    }
    
    /**
     * @dev Get total number of scorecards minted
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    /**
     * @dev Get owner of a token
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }
    
    /**
     * @dev Get balance of an address
     */
    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }
}
