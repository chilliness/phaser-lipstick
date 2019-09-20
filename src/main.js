import Phaser from 'phaser';

// obj用于全局挂载对象
let [gameConfig, obj, gameArchive] = [{}, {}, { level: 1, blood: 3, pass: false }];

document.addEventListener('DOMContentLoaded', () => {
  let game = new Phaser.Game({
    type: Phaser.AUTO,
    banner: false,
    parent: 'game-wrap',
    dom: { createContainer: true },
    width: 1280,
    height: 716,
    scale: {
      mode: Phaser.Scale.HEIGHT_CONTROLS_WIDTH,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [LoadScene, GameScene, PassScene, OverScene]
  });

  gameConfig = {
    cX: game.config.width / 2,
    cY: game.config.height / 2,
    cW: game.config.width,
    cH: game.config.height,
    gameover: false,
    isInit: true,
    handleRnd: () => Phaser.Math.FloatBetween(0.01, 0.05),
    speed: 1,
    limitSpeed: 6,
    speedStep: 0.02,
    minBothAngle: 15,
    initY: game.config.height - 88,
    diffTime: 300,
    blood: 3,
    countdown: 30
  };
});

// 加载场景
class LoadScene extends Phaser.Scene {
  constructor() {
    super('loadScene');
  }

  preload() {
    // 初始化游戏参数
    obj = { ...gameConfig };

    this.load.image('bg', require('../assets/img/bg.png'));
    this.load.image('gameover', require('../assets/img/gameover.png'));
    this.load.image('gamepass', require('../assets/img/gamepass.png'));
    this.load.image('gameready', require('../assets/img/gameready.png'));
    this.load.image('player', require('../assets/img/player.png'));

    this.load.spritesheet('blood', require('../assets/img/blood.png'), { frameWidth: 53, frameHeight: 49 });
    this.load.spritesheet('btn', require('../assets/img/btn.png'), { frameWidth: 273, frameHeight: 83 });
    this.load.spritesheet('clip', require('../assets/img/clip.png'), { frameWidth: 89, frameHeight: 24 });
    this.load.spritesheet('target-left', require('../assets/img/target-left.png'), { frameWidth: 150, frameHeight: 230 });
    this.load.spritesheet('target-right', require('../assets/img/target-right.png'), { frameWidth: 150, frameHeight: 230 });
    this.load.spritesheet('target', require('../assets/img/target.png'), { frameWidth: 230, frameHeight: 230 });

    this.load.bitmapFont('flappyFont', require('../assets/fonts/flappy.png'), require('../assets/fonts/flappy.fnt'));

    this.load.audio('brokenAudio', require('../assets/audio/broken.mp3'));
    this.load.audio('collideAudio', require('../assets/audio/collide.mp3'));
    this.load.audio('throwAudio', require('../assets/audio/throw.mp3'));

    // 加载进度
    let loadText = this.add.text(obj.cX, obj.cY, ['0%', '正在加载'], { font: '40px arial', align: 'center' }).setOrigin(0.5);
    this.load.on('progress', res => loadText.setText([`${parseInt(res * 100)}%`, '正在加载']));

    this.load.on('complete', () => {
      this.add.sprite(obj.cX, obj.cY, 'bg');
      this.add.sprite(obj.cX, obj.cY, 'gameready');

      // 添加开始游戏按钮和事件
      let btn = this.add.sprite(obj.cX, 422, 'btn', 0).setInteractive();
      btn.on('pointerdown', () => this.scene.start('gameScene'));
    });
  }
}

// 游戏场景
class GameScene extends Phaser.Scene {
  constructor() {
    super('gameScene');
  }

  create() {
    // 初始化游戏参数
    obj = { ...gameConfig };

    // 添加背景
    this.add.sprite(obj.cX, obj.cY, 'bg');

    // 添加血
    this._bloods = this.add.group();
    [...''.padEnd(obj.blood)].forEach((item, index) => {
      let which = Number(index >= gameArchive.blood);
      this._bloods.create(index * 73 + 20, 20, 'blood', which).setOrigin(0);
    });

    // 添加倒计时
    this._countdownText = this.add.bitmapText(obj.cW - 20, 20, 'flappyFont', obj.countdown, 60).setOrigin(1, 0);

    // 添加clip
    this._clips = this.add.group();
    [...''.padEnd(6)].forEach((item, index) => this._clips.create(obj.cW - 20, obj.cH - 20 - index * 34, 'clip', 0).setOrigin(1));

    // 添加target
    let which = gameArchive.level - 1;
    this._target = this.add.sprite(obj.cX, 220, 'target', which).setDepth(1);
    this._targetLeft = this.add.sprite(obj.cX - 55, 220, 'target-left', which).setVisible(false);
    this._targetRight = this.add.sprite(obj.cX + 55, 220, 'target-right', which).setVisible(false);

    // 创建player池
    this._players = this.add.group();
    // 添加player
    this._player = this.add.sprite(obj.cX, obj.initY, 'player');

    // 最后一次触发时间
    this._lastTime = 0;

    // 倒计时初始化
    this._countdownTime = +new Date();

    // 是否开启过关动画
    this._isAnim = false;

    // 添加点击事件
    this.input.on('pointerdown', () => {
      let now = +new Date();
      if (obj.isInit && !obj.gameover && now - this._lastTime > obj.diffTime) {
        obj.isInit = false;
        this.sound.play('throwAudio');

        this.tweens.add({
          targets: [this._player],
          y: this._target.y + this._target.width / 2,
          duration: 150,
          onComplete: () => {
            let isHit = false;
            this._lastTime = now;

            this._players.getChildren().forEach(item => {
              if (Math.abs(Phaser.Math.Angle.ShortestBetween(this._target.angle, item._angle)) < obj.minBothAngle) {
                isHit = true;
              }
            });

            // 碰撞判断
            if (!isHit) {
              let temp = this.add.sprite(this._player.x, this._player.y, 'player');
              temp._angle = this._target.angle;
              this._players.add(temp);

              // 同步clips
              let items = this._clips.getChildren();
              let index = items.length - this._players.getChildren().length;
              items[index].setFrame(1);

              if (!index) {
                if (++gameArchive.level > obj.blood) {
                  gameArchive.pass = true;
                } else {
                  this.sound.play('brokenAudio');
                  this._isAnim = true;
                  this._target.destroy();
                  this._player.destroy();
                  let arr = [this._targetLeft.setVisible(true), this._targetRight.setVisible(true), ...this._players.getChildren()];

                  arr.forEach((item, index) =>
                    this.tweens.add({
                      targets: [item],
                      y: obj.cH * 1.5,
                      ease: 'Back.easeIn',
                      duration: Phaser.Math.Between(800, 1000),
                      onComplete: () => {
                        if (arr.length === index + 1) {
                          this.scene.start('gameScene');
                        }
                      }
                    })
                  );
                }
              } else {
                // 准备下一把武器
                this._player.y = obj.initY;
                obj.isInit = true;
              }
            } else {
              this.sound.play('collideAudio');
              this.tweens.add({
                targets: [this._player],
                y: obj.cH * 1.5,
                rotation: 6,
                ease: 'Sine.easeOut',
                duration: 1000,
                onComplete: () => {
                  // 同步存档
                  if (--gameArchive.blood > 0) {
                    this.scene.start('gameScene');
                  }
                }
              });
            }
          }
        });
      }
    });
  }

  update() {
    if (obj.gameover || this._isAnim) {
      return;
    }

    let now = +new Date();

    if (obj.countdown === 0) {
      if (--gameArchive.blood > 0) {
        this.scene.start('gameScene');
      }
    } else {
      if (now > this._countdownTime + 1000) {
        this._countdownTime = now;
        this._countdownText.setText(--obj.countdown);
      }
    }

    // 成功判断
    if (gameArchive.pass) {
      obj.gameover = true;
      this.tweens.pauseAll();
      this.sound.pauseAll();
      this.scene.start('passScene');
    }

    // 失败判断
    if (gameArchive.blood < 1) {
      obj.gameover = true;
      this.tweens.pauseAll();
      this.sound.pauseAll();
      this.scene.start('overScene');
    }

    this._target.angle += obj.speed;
    this._players.getChildren().forEach(item => {
      item.angle += obj.speed;
      let rad = Phaser.Math.DegToRad(item.angle + 90);
      item.x = this._target.x + (this._target.width / 2) * Math.cos(rad);
      item.y = this._target.y + (this._target.width / 2) * Math.sin(rad);
    });

    // 速度变化控制
    obj.speed += obj.speedStep * gameArchive.level;
    if (obj.speed >= obj.limitSpeed) {
      obj.speedStep = -obj.handleRnd();
    } else if (obj.speed <= -obj.limitSpeed) {
      obj.speedStep = obj.handleRnd();
    }
  }
}

// 成功场景
class PassScene extends Phaser.Scene {
  constructor() {
    super('passScene');
  }

  create() {
    this.add.sprite(obj.cX, obj.cY, 'bg');
    this.add.sprite(obj.cX, obj.cY, 'gamepass');

    let btn = this.add.sprite(obj.cX, 422, 'btn', 1).setInteractive();
    btn.on('pointerdown', () => {
      // 重置存档
      gameArchive = { level: 1, blood: 3, pass: false };
      this.scene.start('gameScene');
    });
  }
}

// 失败场景
class OverScene extends Phaser.Scene {
  constructor() {
    super('overScene');
  }

  create() {
    this.add.sprite(obj.cX, obj.cY, 'bg');
    this.add.sprite(obj.cX, obj.cY, 'gameover');

    let btn = this.add.sprite(obj.cX, 422, 'btn', 1).setInteractive();
    btn.on('pointerdown', () => {
      // 重置存档
      gameArchive = { level: 1, blood: 3, pass: false };
      this.scene.start('gameScene');
    });
  }
}
