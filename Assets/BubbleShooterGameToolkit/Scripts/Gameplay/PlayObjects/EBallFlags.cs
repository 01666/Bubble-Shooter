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

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    [Flags]
    public enum EBallFlags
    {
        None = 0,
        Animating = 1 << 0,  // 1  - for wave effect
        MarkedForMatch = 1 << 1,  // 2  - for matching
        MarkConnected = 1 << 2,  // 4 - for falling separated balls
        Falling = 1 << 3,  // 8 - for falling balls
        MarkedForDestroy = 1 << 4,  // 16 - for destroying balls
        DirtyToCheckNeighbours = 1 << 5,  // 32 - for checking neighbours
        Destroying = 1 << 6,  // 64 - for destroying balls
        Pinned = 1 << 7, // 128 - used for all static balls on field
        Root = 1 << 8, // 256 - can this ball hold balls like supporting structure
        IgnoreRaycast = 1 << 9, // 512 - temp flag to avoid by launching ball, not consider as neighbour
    }
}