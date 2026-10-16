// // ©2015 - 2024 Candy Smith
// // All rights reserved
// // Redistribution of this software is strictly not allowed.
// // Copy of this software can be obtained from unity asset store only.
// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// // FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// // THE SOFTWARE.

using System;
using System.Collections.Generic;
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Covers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Properties;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    /// basic ball class
    public partial class Ball : Targetable
    {
        [SerializeField]
        private int score = 10; // score for destroying the ball
        [SerializeField]
        public int scoreMultiplier = 1; // score multiplier
        [SerializeField]
        public DestroyProperties destroyProperties; // properties for destroying the ball

        // Ball collider handler for control colliders and wall collisions
        public BallColliderHandler BallColliderHandler { get; private set; }
        private BallMovement ballMovement;
        public BallDestruction ballDestruction;
        public IBallSoundable ballSoundable;

        public Vector2Int position; // position in the matrix
        public Ball[] neighbours; // neighbours of the ball in hex grid

        public Cover cover; // cover of the ball appear above the ball and protect it
        public Attachable hidden; // hidden object attached to the ball using as target
        public LabelItem label; // label of the ball appear above the ball and give some bonuses
        public DestroyProperties DestroyProperties => cover != null ? cover.destroyProperties : destroyProperties;

        protected new AudioProperties audioProperties => cover != null ? cover.audioProperties : base.audioProperties;
        
        private Camera _camera;
        public LevelManager levelManager => LevelManager.instance;
        public Action<BallDestructionOptions> OnDestroy;
        public Action<Ball> OnTouch;
        
        // holds all root balls for performance in searching connected balls
        public static readonly HashSet<Ball> RootBalls = new();
        // some ball states and temporary flags
        public EBallFlags _flags;
        public EBallFlags Flags
        {
            get => _flags;
            set
            {
                // If the flag is being set to Root, add to HashSet
                if (!HasFlag(EBallFlags.Root) && value.HasFlag(EBallFlags.Root))
                {
                    RootBalls.Add(this);
                }
                // If the flag is being unset from Root, remove from HashSet
                else if (HasFlag(EBallFlags.Root) && !value.HasFlag(EBallFlags.Root))
                {
                    RootBalls.Remove(this);
                }

                _flags = value;
            }
        }

        // check if the ball has the flag
        public bool HasFlag(EBallFlags flag)
        {
            return (_flags & flag) == flag;
        }

        private void Awake()
        {
            _camera = Camera.main;
            BallColliderHandler = new BallColliderHandler(GetComponent<CircleCollider2D>());
            ballMovement = new BallMovement(this);
            ballDestruction = new BallDestruction(this, fxPrefab);
            ballSoundable = new BallSound();
        }

        // reset properties after spawn from pool
        public override void OnEnable()
        {
            base.OnEnable();
            Flags = EBallFlags.None;
            transform.rotation = Quaternion.identity;
            neighbours = new Ball[6];
            scoreMultiplier = 1;
        }

        // color for aim for every ball except balls with specific color (check ColorBall)
        public virtual Color GetColorForAim() => Color.yellow;
        
        // set position of the ball in the matrix
        public virtual void SetPosition(Vector2Int pos)
        {
            ballMovement.SetPosition(pos);
        }

        // start falling of the ball
        public virtual void Fall()
        {
            ballMovement.Fall();
        }
        
        // check if the ball is visible on the screen
        public bool IsVisible()
        {
            float upperBound = _camera.transform.position.y + _camera.orthographicSize;
            return transform.position.y < upperBound + 10f;
        }

        // Called when the ball is touched by another ball
        public virtual void OnTouched(Ball touchedByBall)
        {
            ballSoundable.PlayExplosionSound(audioProperties.touchSound);
            if(label != null && (!destroyProperties.destroyByTouch && !destroyProperties.destroyByExplosion || this is AbsorbingBall))
                label.OnTouched(touchedByBall, this);
                
            cover?.OnTouched(touchedByBall, this);
            OnTouch?.Invoke(this);
        }
        
        // Called when the ball is directly touched by another ball
        public virtual void OnDirectlyTouched(Ball touchedByBall)
        {
            ballSoundable.PlayExplosionSound(audioProperties.touchDirectlySound);
            cover?.OnTouched(touchedByBall, this);
        }
        
        /// <summary>
        /// destroy the ball
        /// </summary>
        /// <param name="options">options includes source of destruction, effects, sounds, score control </param>
        /// <returns>true is the ball can be destroyed</returns>
        public virtual bool DestroyBall(BallDestructionOptions options = null)
        {
            return ballDestruction.DestroyBall(options);
        }

        public int GetScore()
        {
            return score * scoreMultiplier;
        }

        public void DisableAndReturnToPool()
        {
            //clear all flags
            Flags = EBallFlags.None;

            BallColliderHandler.DisableCollider();
            if (parent != transform.parent)
                RestoreParent();
            transform.localScale = Vector3.one;
            PoolObject.Return(gameObject);
        }

        public virtual void Uncover()
        {
        }

        public bool IsTarget(int targetIndex)
        {
            return targetIndex == GetTargetIndex() || cover != null && targetIndex == cover.GetTargetIndex() || hidden != null && targetIndex == hidden.GetTargetIndex() || label != null && targetIndex == label.GetTargetIndex();
        }

        public override int GetHashCode()
        {
            return base.GetHashCode() + position.GetHashCode();
        }
        
        public void SetSortingLayer(int layerID)
        {
            foreach (var spriteRenderer in GetComponentsInChildren<SpriteRenderer>())
            {
                spriteRenderer.sortingLayerID = layerID;
            }
            // order in particles
            var particles = GetComponentsInChildren<ParticleSystem>();
            foreach (var particle in particles)
            {
                particle.GetComponent<Renderer>().sortingLayerID = layerID;
            }
        }

        public bool AnyValidNeighbour()
        {
            foreach (var neighbour in neighbours)
            {
                if (neighbour != null && neighbour is not AbsorbingBall && (neighbour.DestroyProperties.destroyByTouch || neighbour.DestroyProperties.destroyByExplosion) && !neighbour.Flags.HasFlag(EBallFlags.Destroying))
                    return true;
            }

            return false;
        }

        /// disable collision with the launched ball
        public void IgnoreRaycast()
        {
            if(cover is { isProtectingBall: false } or null)
            {
                gameObject.layer = LayerMask.NameToLayer("Ignore Raycast");
                Flags |= EBallFlags.IgnoreRaycast;
            }
        }
        public void TryToFall()
        {
            if(cover is { isProtectingBall: false } or null)
                gameObject.layer = LayerMask.NameToLayer("FallingBubble");
        }

        public bool IsValid()
        {
            return this != null && this is not AbsorbingBall && !this.Flags.HasFlag(EBallFlags.Destroying);
        }
    }
}