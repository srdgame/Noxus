import * as Types from "../../io/dofus/types"
import * as Messages from "../../io/dofus/messages"
import CharacterManager from "../../managers/character_manager.js"
import ChatRestrictionManager from "../../managers/chat_restriction_manager.js"
import WorldManager from "../../managers/world_manager.js"
import WorldServer from "../../network/world"
import Logger from "../../io/logger"
import ConfigManager from "../../utils/configmanager.js"
import DBManager from "../../database/dbmanager"

export default class Character {

    lastSalesMessage = 0;
    lastSeekMessage = 0;
    lastMessage = 0;
    isTemporaryMuted = false;
    firstContext = true;
    client = null;

    constructor(raw) {
        this._id = raw._id;
        this.accountId = raw.accountId;
        this.name = raw.name;
        this.breed = raw.breed;
        this.sex = raw.sex;
        this.colors = raw.colors;
        this.cosmeticId = raw.cosmeticId;
        this.level = raw.level;
        this.experience = raw.experience;
        this.kamas = raw.kamas;
        this.mapid = raw.mapid;
        this.cellid = raw.cellid;
        this.dirId = raw.dirId;
        this.statsPoints = raw.statsPoints;
        this.spellPoints = raw.spellPoints;

        if(!raw.stats) {
            this.stats = [];
            this.stats[10] = new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0);
            this.stats[11] = new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0);
            this.stats[12] = new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0);
            this.stats[13] = new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0);
            this.stats[14] = new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0);
            this.stats[15] = new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0);
        }
        else {
            this.stats = [];
            this.stats[10] = new Types.CharacterBaseCharacteristic(raw.stats.strength, 0, 0, 0, 0);
            this.stats[11] = new Types.CharacterBaseCharacteristic(raw.stats.vitality, 0, 0, 0, 0);
            this.stats[12] = new Types.CharacterBaseCharacteristic(raw.stats.wisdom, 0, 0, 0, 0);
            this.stats[13] = new Types.CharacterBaseCharacteristic(raw.stats.chance, 0, 0, 0, 0);
            this.stats[14] = new Types.CharacterBaseCharacteristic(raw.stats.agility, 0, 0, 0, 0);
            this.stats[15] = new Types.CharacterBaseCharacteristic(raw.stats.intelligence, 0, 0, 0, 0);
        }
        
        this.life = raw.life ? raw.life : this.getMaxLife();
    }

    getStatById(id) {
        return this.stats[id];
    }

    getBaseSkin() {
        return CharacterManager.getDefaultLook(this.breed, this.sex);
    }

    getHeadSkinId() {
        return parseInt(CharacterManager.getHead(this.cosmeticId).skins);
    }

    getBreed() {
        return CharacterManager.getBreed(this.breed);
    }

    getBonesId() {
        return 1;
    }

    getColors() {
        var nextColors = [];
        for (var i = 0; i < this.colors.length; i++) {
            nextColors[i] = i + 1 << 24 | this.colors[i] & 16777215;
        }
        return nextColors;
    }

    getEntityLook() {
        return new Types.EntityLook(this.getBonesId(), [this.getBaseSkin(), this.getHeadSkinId()],
            this.getColors(), [120], [])
    }

    getCharacterBaseInformations() {
        return new Types.CharacterBaseInformations(this._id, this.name, this.level, this.getEntityLook(), this.breed, this.sex);
    }

    getCharacterRestrictions() {
        return new Types.ActorRestrictionsInformations(false, false, false, false, false, false, false, false, false, false, false, false, false, false,
            false, false, false, false, false, false, false);
    }

    getGameRolePlayCharacterInformations(account) {
        return new Types.GameRolePlayCharacterInformations(new Types.ActorAlignmentInformations(0, 0, 0, 0),
            new Types.HumanInformations(this.getCharacterRestrictions(), this.sex, []), account.uid, this.name, this._id, this.getEntityLook(),
            new Types.EntityDispositionInformations(this.cellid, this.dirId));
    }

    getMap() {
        return WorldManager.getMapInstantly(this.mapid);
    }

    replyText(string) {
        try { this.client.send(new Messages.TextInformationMessage(0, 0, [string])); }
        catch (error) { Logger.error(error); }
    }

    replyError(string) {
        try { this.client.send(new Messages.TextInformationMessage(0, 0, ["<font color=\"#ff0000\">" + string + "</font>"])); }
        catch (error) { Logger.error(error); }
    }

    replyWelcome(string) {
        try { this.client.send(new Messages.TextInformationMessage(0, 0, ["<font color=\"#ffffff\">" + string + "</font>"])); }
        catch (error) { Logger.error(error); }
    }

    replyLangsMessage(id, params) {
        try { this.client.send(new Messages.TextInformationMessage(1, id, params)); }
        catch (error) { Logger.error(error); }
    }

    replySystemMessage(string) {
        try { this.client.send(new Messages.SystemMessageDisplayMessage(true, 61, [string])); }
        catch (error) { Logger.error(error); }
    }

    canSendSalesMessage() {
        return ChatRestrictionManager.canSendSalesMessages(this) ? true : false;
    }

    updateLastSalesMessage() {
        var time = Date.now || function () { return +new Date; };
        this.lastSalesMessage = time();
    }

    canSendSeekMessage() {
        return ChatRestrictionManager.canSendSeekMessage(this) ? true : false;
    }

    updateLastSeekMessage() {
        var time = Date.now || function () { return +new Date; };
        this.lastSeekMessage = time();
    }

    canSendMessage() {
        return ChatRestrictionManager.canSendMessage(this) ? true : false;
    }

    updateLastMessage() {
        var time = Date.now || function () { return +new Date; };
        this.lastMessage = time();
        this.isTemporaryMuted = false;
    }

    disconnect(reason) {
        if (reason)
            this.client.send(new Messages.SystemMessageDisplayMessage(true, 61, [reason]));
        this.dispose();
    }

    dispose() {
        this.client.close();
    }

    ban(byName, reason) {
        var self = this;
        DBManager.updateAccount(this.client.account.uid, { locked: 1 }, function () {
            if (reason)
                self.disconnect("Vous avez été banni par " + byName + ": " + reason);
            else
                self.disconnect("Vous avez été banni par " + byName);
        });
    }

    save(callback) {
        var self = this;
        var toUpdate = {
            mapid: this.mapid,
            cellid: this.cellid,
            dirId: this.dirId,
            level: this.level,
            experience: this.experience,
            kamas: this.kamas,
            statsPoints: this.statsPoints,
            spellPoints: this.spellPoints,
            life: this.life,
            stats: {
                strength: this.getStatById(10).base,
                vitality: this.getStatById(11).base,
                wisdom: this.getStatById(12).base,
                chance: this.getStatById(13).base,
                agility: this.getStatById(14).base,
                intelligence: this.getStatById(15).base,
            }
        };
        DBManager.updateCharacter(this._id, toUpdate, function () {
            Logger.infos("Character '" + self.name + "(" + self._id + ")' saved");
            if (callback) callback();
        });
    }

    ///////////////////
    // Stats methods
    ///////////////////

    getBaseLife() {
        return 42; //TODO: Per class
    }

    getMaxLife() {
        return this.getBaseLife() + this.getStatById(11).base;
    }

    getActorExtendedAlignmentInformations() {
        return new Types.ActorExtendedAlignmentInformations(0, 0, 0, 0, 0, 0, 0, 0);
    }

    getCharacterCharacteristicsInformations() {
        return new Types.CharacterCharacteristicsInformations(
            this.experience, 0, 0, 
            this.kamas, 
            this.statsPoints, 0, 
            this.spellPoints, 
            this.getActorExtendedAlignmentInformations(),
            this.life, this.getMaxLife(), 10000, 10000, 6, 6,
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            this.getStatById(10),
            this.getStatById(11),
            this.getStatById(12),
            this.getStatById(13),
            this.getStatById(14),
            this.getStatById(15),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            0,
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            new Types.CharacterBaseCharacteristic(0, 0, 0, 0, 0),
            [], 0
        );
    }

    sendStats() {
        this.client.send(new Messages.CharacterStatsListMessage(this.getCharacterCharacteristicsInformations()));
    }
}