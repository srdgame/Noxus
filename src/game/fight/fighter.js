import * as Messages from "../../io/dofus/messages"
import * as Types from "../../io/dofus/types"
import Logger from "../../io/logger"
import Fight from "./fight"
import CharacterManager from "../../managers/character_manager"
import WorldManager from "../../managers/world_manager"

export default class Fighter {

    constructor(character, fight) {
        this.character = character;
        this.fight = fight;
        this.character.fighter = this;
        this.character.fight = this.fight;
        this.team = null;
        this.ready = false;
        this.cellId = -1;
        this.dirId = 3;
        this.alive = true;
        CharacterManager.applyRegen(this.character);
        this.current = { life: this.character.life, AP: this.character.statsManager.getTotalStats(1), MP: this.character.statsManager.getTotalStats(2) }
    }

    get id() {
        return this.character._id;
    }

    get level() {
        return this.character.level;
    }

    send(packet) {
        this.character.client.send(packet);
    }

    getStats() {
        return this.character.statsManager;
    }

    resetPoints() {
        this.current.AP = this.character.statsManager.getTotalStats(1);
        this.current.MP = this.character.statsManager.getTotalStats(2);
    }

    createContext() {
        this.send(new Messages.GameContextDestroyMessage());
        this.send(new Messages.GameContextCreateMessage(2));
    }

    restoreRoleplayContext() {
        this.send(new Messages.GameContextDestroyMessage());
        this.send(new Messages.GameContextCreateMessage(1));
        WorldManager.teleportClient(this.character.client, this.character.mapid, this.character.cellid, function(result){
            if (!result)
            {
                Logger.error("An error occured while trying to load a map for the character " + this.character.name);
                client.character.disconnect();
            }
        });
    }

    getGameFightMinimalStatsPreparation() {
        return new Types.GameFightMinimalStatsPreparation(this.current.life, this.character.statsManager.getMaxLife(), this.character.statsManager.getMaxLife(), 0, 0,
            this.current.AP, this.character.statsManager.getTotalStats(1),
            this.current.MP, this.character.statsManager.getTotalStats(2),
            0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000);
    }

    getGameFightFighterInformations() {
        return new Types.GameFightMutantInformations(this.character._id, this.character.getEntityLook(),
            new Types.EntityDispositionInformations(this.cellId, this.dirId), this.team.id, 0, this.alive, this.getGameFightMinimalStatsPreparation(), [],
            this.character.name, new Types.PlayerStatus(1), this.character.level);
    }

    setReadyState(state) {
        if(this.fight.fightState == Fight.FIGHT_STATES.STARTING) {
            this.ready = state;
            this.fight.send(new Messages.GameFightHumanReadyStateMessage(this.character._id, this.ready));
            this.fight.checkStartupPhaseReady();
        }
    }

    getFightTeamMemberCharacterInformations() {
        return new Types.FightTeamMemberCharacterInformations(this.character._id, this.character.name, this.character.level);
    }

    passTurn() {
        if(this.fight.timeline.currentFighter()) {
            if(this.fight.timeline.currentFighter().character._id == this.character._id) {
                this.fight.timeline.next();
            }
        }
    }
}