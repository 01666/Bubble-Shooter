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

using System.Collections;
using System.Collections.Generic;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.Serialization;

namespace BubbleShooterGameToolkit.Scripts.Audio
{
	[RequireComponent(typeof(AudioSource))]
	public class SoundBase : SingletonBehaviour<SoundBase>
	{
		[SerializeField]
		private AudioMixer mixer;
		[SerializeField]
		private string soundParameter = "soundVolume";
		
		public AudioClip click;
		public AudioClip rotation;
		public AudioClip[] powerup_click;
		public AudioClip powerup_fill;
		public AudioClip[] combo;
		public AudioClip[] swish;
		public AudioClip bug;
		public AudioClip bugDissapier;
		public AudioClip pops;
		public AudioClip boiling;
		public AudioClip hit;
		public AudioClip kreakWheel;
		public AudioClip spark;
		public AudioClip winSound;
		public AudioClip gameOver;
		public AudioClip scoringStar;
		public AudioClip scoring;
		public AudioClip alert;
		[FormerlySerializedAs("aplauds")]
		public AudioClip cheers;
		public AudioClip OutOfMoves;
		public AudioClip Boom;
		public AudioClip black_hole;
		public AudioClip coins;
		public AudioClip lightning;
		public AudioClip getStar;
		public AudioClip failed;
		public AudioClip beeBzz;

		public AudioClip[] readyGo;
		public AudioClip[] baby;
		public AudioClip[] character;
		public AudioClip bubble_cannon;
		public AudioClip leaf;
		public AudioClip wave;
		public AudioClip coinsSpend;
		public AudioClip luckySpin;
		public AudioClip heats;
		[FormerlySerializedAs("warningMove")]
		public AudioClip warningMoves;
		public AudioClip warningTime;
		public AudioClip buyBoost;

		private AudioSource audioSource;

		private readonly HashSet<AudioClip> clipsPlaying = new HashSet<AudioClip>();

		public override void Awake()
		{
			base.Awake();
			audioSource = GetComponent<AudioSource>();
		}

		private void Start()
		{
			mixer.SetFloat(soundParameter, PlayerPrefs.GetInt("Sound", 1) == 0 ? -80 : 0);
		}

		public void PlaySound(AudioClip clip)
		{
			audioSource.PlayOneShot(clip);
		}

		public void PlayDelayed(AudioClip clip, float delay)
		{
			StartCoroutine(PlayDelayedCoroutine(clip, delay));
		}

		private IEnumerator PlayDelayedCoroutine(AudioClip clip, float delay)
		{
			yield return new WaitForSeconds(delay);
			PlaySound(clip);
		}

		public void PlaySoundsRandom(AudioClip[] clip)
		{
			SoundBase.instance.PlaySound(clip[Random.Range(0, clip.Length)]);
		}

		public void PlayLimitSound(AudioClip clip)
		{
			if (clipsPlaying.Add(clip)){
				PlaySound(clip);
				StartCoroutine(WaitForCompleteSound(clip));
			}
		}

		IEnumerator WaitForCompleteSound(AudioClip clip)
		{
			yield return new WaitForSeconds(0.1f);
			clipsPlaying.Remove(clip);
		}
	}
}
